import "server-only";
// The mental-game tools on her Mental GP page: intensity checks, self-scans,
// guided sessions she has as routines, and the practice journal.
import type { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";
import type { IntensityContext } from "@/lib/mental";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type IntensityCheck = { id: string; checked_on: string; context: IntensityContext; level: number; adjustment: string | null };
export type MentalScan = { month: string; scores: number[]; note: string | null };
export type JournalEntry = { entry_date: string; purpose: string | null; worked: string | null; fix: string | null };

export async function loadMentalTools(supabase: Supabase, playerId: string, today: string) {
  const [checks, scans, routines] = await Promise.all([
    supabase
      .from("mental_intensity_checks")
      .select("id, checked_on, context, level, adjustment")
      .eq("player_id", playerId)
      .order("checked_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("mental_scans").select("month, scores, note").eq("player_id", playerId).order("month", { ascending: false }).limit(6),
    supabase
      .from("player_activities")
      .select("id, drill:drills(guide)")
      .eq("player_id", playerId)
      .eq("category", "mental")
      .or(`ends_on.is.null,ends_on.gte.${today}`),
  ]);
  const guides = new Set(
    ((routines.data ?? []) as { drill: { guide: string | null } | null }[]).map((r) => r.drill?.guide).filter((g): g is string => Boolean(g)),
  );
  return {
    checks: (checks.data ?? []) as IntensityCheck[],
    scans: (scans.data ?? []) as MentalScan[],
    guides: [...guides],
  };
}

/** Her journal for one week (Monday..Sunday), the week's look-back and which days have a team practice. */
export async function loadJournalWeek(supabase: Supabase, playerId: string, monday: string) {
  const sunday = addDays(monday, 6);
  const { data: rosterData } = await supabase.from("roster_entries").select("team_id").eq("player_id", playerId).eq("active", true);
  const teamIds = [...new Set(((rosterData ?? []) as { team_id: string }[]).map((r) => r.team_id))];
  const [entries, week, practices] = await Promise.all([
    supabase.from("journal_entries").select("entry_date, purpose, worked, fix").eq("player_id", playerId).gte("entry_date", monday).lte("entry_date", sunday),
    supabase.from("journal_weeks").select("look_back").eq("player_id", playerId).eq("week_start", monday).maybeSingle(),
    teamIds.length
      ? supabase
          .from("team_events")
          .select("event_date, title, start_time")
          .in("team_id", teamIds)
          .eq("kind", "practice")
          .gte("event_date", monday)
          .lte("event_date", sunday)
          .order("start_time", { nullsFirst: true })
      : Promise.resolve({ data: [] }),
  ]);
  const practiceDays = new Map<string, string>();
  for (const p of (practices.data ?? []) as { event_date: string; title: string | null; start_time: string | null }[]) {
    if (!practiceDays.has(p.event_date)) practiceDays.set(p.event_date, p.title || "Practice");
  }
  return {
    entries: (entries.data ?? []) as JournalEntry[],
    lookBack: ((week.data as { look_back: string | null } | null)?.look_back ?? null) as string | null,
    practiceDays,
  };
}
