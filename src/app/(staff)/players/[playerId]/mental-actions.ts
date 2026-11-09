"use server";

// The mental-game tools on her Mental GP page (Standard): My signals, intensity
// checks, the monthly self-scan, guided sessions and the practice journal. The
// player edits her own; coaches can too (actForCheck). RLS checks it again.
import { refresh } from "next/cache";
import { actForCheck, actorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { MENTAL_FIELDS } from "./shared";
import { isISODate, isoWeekday, todayISO, weekStart } from "@/lib/dates";
import {
  ADJUSTMENT_MAX, INTENSITY_CONTEXTS, JOURNAL_LIMITS, SCAN_NOTE_MAX, SIGNALS, SIGNAL_MAX, isValidScan, monthStart, sessionBySlug,
} from "@/lib/mental";
import { setTwisCheck } from "./twis-actions";
import { STALE, failed, must, runAction } from "@/lib/actions";

async function playerFrom(fd: FormData): Promise<{ playerId: string } | { error: string }> {
  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const denied = await actForCheck(playerId);
  return denied ? { error: denied } : { playerId };
}

function level(fd: FormData, name: string): number | null {
  const n = Number(fd.get(name));
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
}

/** My signals: green / yellow / red, a release for yellow and red, and her zone. */
export async function saveSignals(_prev: FormState, fd: FormData): Promise<FormState> {
  const who = await playerFrom(fd);
  if ("error" in who) return { error: who.error };
  const values: Record<string, string | number | null> = {};
  for (const s of SIGNALS) {
    for (const field of [s.signs, s.release].filter(Boolean) as string[]) {
      const v = text(fd, field);
      if (v && v.length > SIGNAL_MAX) return { error: `Keep each one under ${SIGNAL_MAX} characters.` };
      values[field] = v;
    }
  }
  const low = level(fd, "zone_low");
  const high = level(fd, "zone_high");
  if ((low === null) !== (high === null)) return { error: "Pick both ends of your zone, or neither." };
  if (low !== null && high !== null && low > high) return { error: "The low end of your zone can't be above the high end." };
  values.zone_low = low;
  values.zone_high = high;
  const supabase = await createClient();
  const { error } = await supabase.from("mental_game_plans").upsert({ player_id: who.playerId, ...values }, { onConflict: "player_id" });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

/** An intensity check: 1-10 before a game or practice, and what she'll adjust. */
export async function logIntensity(_prev: FormState, fd: FormData): Promise<FormState> {
  const who = await playerFrom(fd);
  if ("error" in who) return { error: who.error };
  const value = level(fd, "level");
  if (value === null) return { error: "Pick a number from 1 to 10." };
  const context = INTENSITY_CONTEXTS.find((c) => c === fd.get("context")) ?? "game";
  const adjustment = text(fd, "adjustment");
  if (adjustment && adjustment.length > ADJUSTMENT_MAX) return { error: `Keep it under ${ADJUSTMENT_MAX} characters.` };
  const supabase = await createClient();
  const { error } = await supabase
    .from("mental_intensity_checks")
    .insert({ player_id: who.playerId, checked_on: todayISO(), context, level: value, adjustment });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function removeIntensityCheck(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const who = await playerFrom(fd);
    const id = text(fd, "id");
    if ("error" in who) return failed(who.error);
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("mental_intensity_checks").delete().eq("id", id).eq("player_id", who.playerId));
    refresh();
  });
}

/** This month's self-scan (one per month; saving again replaces it). */
export async function saveScan(input: { playerId: string; scores: number[]; note: string }): Promise<{ error: string | null }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId)) return { error: "Unknown player." };
  if (!isValidScan(input.scores)) return { error: "Rate every skill from 1 to 5." };
  const note = (input.note ?? "").trim();
  if (note.length > SCAN_NOTE_MAX) return { error: `Keep the note under ${SCAN_NOTE_MAX} characters.` };
  const supabase = await createClient();
  const { error } = await supabase.from("mental_scans").upsert(
    { player_id: input.playerId, month: monthStart(todayISO()), scores: input.scores, note: note || null, updated_at: new Date().toISOString() },
    { onConflict: "player_id,month" },
  );
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/**
 * A guided session is done. If she has it as a routine scheduled today (or any day
 * this week), it's checked off in TWIS, which also counts toward achievements.
 */
export async function finishGuidedSession(input: { playerId: string; slug: string }): Promise<{ error: string | null; checked: boolean }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied, checked: false };
  if (!isUuid(input.playerId) || !sessionBySlug(input.slug)) return { error: "Unknown session.", checked: false };
  const today = todayISO();
  const supabase = await createClient();
  const { data } = await supabase
    .from("player_activities")
    .select("id, days, starts_on, ends_on, drill:drills!inner(guide)")
    .eq("player_id", input.playerId)
    .eq("category", "mental")
    .eq("drill.guide", input.slug)
    .lte("starts_on", today)
    .or(`ends_on.is.null,ends_on.gte.${today}`);
  const routine = ((data ?? []) as { id: string; days: number[] }[]).find((r) => r.days.length === 0 || r.days.includes(isoWeekday(today)));
  if (!routine) return { error: null, checked: false };
  const onDate = routine.days.length === 0 ? weekStart(today) : today;
  const res = await setTwisCheck({ playerId: input.playerId, kind: "activity", refId: routine.id, onDate, checked: true });
  return { error: res.error, checked: !res.error };
}

/** One day of the practice journal: her purpose before, what worked and what to fix after. */
export async function saveJournalEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  const who = await playerFrom(fd);
  if ("error" in who) return { error: who.error };
  const date = text(fd, "entry_date");
  if (!isISODate(date)) return { error: "Unknown day." };
  const purpose = text(fd, "purpose");
  const worked = text(fd, "worked");
  const fix = text(fd, "fix");
  if ((purpose?.length ?? 0) > JOURNAL_LIMITS.purpose) return { error: `Keep your purpose under ${JOURNAL_LIMITS.purpose} characters.` };
  if ((worked?.length ?? 0) > JOURNAL_LIMITS.worked || (fix?.length ?? 0) > JOURNAL_LIMITS.fix) {
    return { error: `Keep each answer under ${JOURNAL_LIMITS.worked} characters.` };
  }
  const supabase = await createClient();
  const { error } =
    purpose || worked || fix
      ? await supabase
          .from("journal_entries")
          .upsert({ player_id: who.playerId, entry_date: date, purpose, worked, fix, updated_at: new Date().toISOString() }, { onConflict: "player_id,entry_date" })
      : await supabase.from("journal_entries").delete().eq("player_id", who.playerId).eq("entry_date", date);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

/** The week's look-back. */
export async function saveJournalWeek(_prev: FormState, fd: FormData): Promise<FormState> {
  const who = await playerFrom(fd);
  if ("error" in who) return { error: who.error };
  const monday = text(fd, "week_start");
  if (!isISODate(monday) || weekStart(monday) !== monday) return { error: "Unknown week." };
  const lookBack = text(fd, "look_back");
  if ((lookBack?.length ?? 0) > JOURNAL_LIMITS.lookBack) return { error: `Keep it under ${JOURNAL_LIMITS.lookBack} characters.` };
  const supabase = await createClient();
  const { error } = lookBack
    ? await supabase
        .from("journal_weeks")
        .upsert({ player_id: who.playerId, week_start: monday, look_back: lookBack, updated_at: new Date().toISOString() }, { onConflict: "player_id,week_start" })
    : await supabase.from("journal_weeks").delete().eq("player_id", who.playerId).eq("week_start", monday);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

// Mental GP
// ---------------------------------------------------------------------------

export async function saveMentalPlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await actorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const notHers = await actForCheck(playerId);
  if (notHers) return { error: notHers };

  const values = Object.fromEntries(MENTAL_FIELDS.map((f) => [f.name, text(fd, f.name)]));
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const { error } = await supabase
    .from("mental_game_plans")
    .upsert({ player_id: playerId, ...values, updated_by: auth?.claims?.sub ?? null }, { onConflict: "player_id" });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

// ---------------------------------------------------------------------------
