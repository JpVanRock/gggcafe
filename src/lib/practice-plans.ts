import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { compareJersey } from "@/lib/softball";
import type { DrillTag, PlanPosition, PracticeSetting } from "@/lib/dugout";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PlanBlock = {
  drill_id: string | null;
  name: string;
  description: string | null;
  tags: DrillTag[];
  minutes: number | null;
  coaches: string[];
  equipment: string | null;
  video_url: string | null;
};

export type PlanSpot = { position: PlanPosition; player_id: string };

export type PracticePlan = {
  id: string;
  team: { id: string; name: string };
  practice_date: string;
  start_time: string | null;
  setting: PracticeSetting;
  total_minutes: number;
  location: string | null;
  focus: string | null;
  status: "draft" | "final";
  finalized_at: string | null;
  shared_at: string | null;
  /** who wrote it: an assistant coach may change only her own plans */
  created_by: string | null;
  blocks: PlanBlock[];
  spots: PlanSpot[];
};

export type RosterPlayer = {
  id: string;
  name: string;
  /** "#7 Avery L." for chips on the field */
  short: string;
  number: string | null;
  primary: string | null;
};

export async function loadPracticePlan(supabase: Supabase, planId: string): Promise<PracticePlan | null> {
  const { data } = await supabase
    .from("practice_plans")
    // one literal string, so the client can type the result
    .select(
      "id, practice_date, start_time, setting, total_minutes, location, focus, status, finalized_at, shared_at, created_by, team:teams(id, name), blocks:practice_plan_drills(drill_id, name, description, tags, minutes, coaches, equipment, video_url, position), spots:practice_plan_positions(position, player_id, sort)",
    )
    .eq("id", planId)
    .maybeSingle();
  if (!data) return null;
  const row = data as PracticePlan & {
    blocks: (PlanBlock & { position: number })[];
    spots: (PlanSpot & { sort: number })[];
  };
  return {
    ...row,
    start_time: row.start_time ? row.start_time.slice(0, 5) : null,
    blocks: [...row.blocks]
      .sort((a, b) => a.position - b.position)
      .map((b) => ({ drill_id: b.drill_id, name: b.name, description: b.description, tags: b.tags, minutes: b.minutes, coaches: b.coaches, equipment: b.equipment, video_url: b.video_url })),
    spots: [...row.spots].sort((a, b) => a.sort - b.sort).map(({ position, player_id }) => ({ position, player_id })),
  };
}

type RosterRow = {
  jersey_number: string | null;
  player: { id: string; first_name: string; last_name: string; preferred_name: string | null; primary_position: string | null } | null;
  season: { start_date: string | null } | null;
};

function toRosterPlayer(p: NonNullable<RosterRow["player"]>, number: string | null): RosterPlayer {
  const first = p.preferred_name || p.first_name;
  return {
    id: p.id,
    name: `${first} ${p.last_name}`,
    short: `${number ? `#${number} ` : ""}${first} ${p.last_name.charAt(0)}.`,
    number,
    primary: p.primary_position,
  };
}

/**
 * The team's active roster for its latest season, by jersey number, plus anyone
 * already placed in the plan who isn't on it (so names never go missing).
 */
export async function loadPlanRoster(supabase: Supabase, teamId: string, placedIds: string[] = []): Promise<RosterPlayer[]> {
  const { data } = await supabase
    .from("roster_entries")
    .select("jersey_number, player:players(id, first_name, last_name, preferred_name, primary_position), season:seasons(start_date)")
    .eq("team_id", teamId)
    .eq("active", true);
  const rows = ((data ?? []) as RosterRow[]).filter((r) => r.player);
  const latest = rows.reduce<string>((max, r) => ((r.season?.start_date ?? "") > max ? (r.season?.start_date ?? "") : max), "");
  const current = rows.filter((r) => (r.season?.start_date ?? "") === latest);

  const byId = new Map<string, RosterPlayer>();
  for (const r of current.sort(
    (a, b) => compareJersey(a.jersey_number, b.jersey_number) || a.player!.last_name.localeCompare(b.player!.last_name),
  )) {
    if (!byId.has(r.player!.id)) byId.set(r.player!.id, toRosterPlayer(r.player!, r.jersey_number));
  }

  const missing = placedIds.filter((id) => !byId.has(id));
  if (missing.length) {
    const fromOther = rows.filter((r) => missing.includes(r.player!.id));
    const { data: players } = await supabase
      .from("players")
      .select("id, first_name, last_name, preferred_name, primary_position")
      .in("id", missing);
    for (const p of (players ?? []) as NonNullable<RosterRow["player"]>[]) {
      byId.set(p.id, toRosterPlayer(p, fromOther.find((r) => r.player!.id === p.id)?.jersey_number ?? null));
    }
  }
  return [...byId.values()];
}

/** Coach names to assign drills to: coaches and admins on the staff list. */
export async function loadCoachNames(supabase: Supabase): Promise<string[]> {
  const { data } = await supabase.from("staff").select("display_name").in("role", ["coach", "admin"]).order("display_name");
  return ((data ?? []) as { display_name: string }[]).map((s) => s.display_name);
}

export type StaffContact = { user_id: string; display_name: string; email: string };

/** Coaches and admins with their emails (coaches and admins only; empty for viewers). */
export async function loadCoachingStaff(supabase: Supabase): Promise<StaffContact[]> {
  const { data, error } = await supabase.rpc("coaching_staff");
  if (error) {
    console.error("coaching_staff failed:", error);
    return [];
  }
  return ((data ?? []) as StaffContact[]).filter((s) => s.email);
}
