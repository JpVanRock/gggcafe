"use server";

// Pitching (Phase 4): her bullpen sessions and game plans. She or a coach saves them.
import { refresh } from "next/cache";
import { actForCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { isISODate, isoWeekday, todayISO, weekStart } from "@/lib/dates";
import { cleanScript } from "@/lib/bullpen";
import { setTwisCheck } from "./twis-actions";

/** A thrown bullpen: each pitch hit or missed. Ticks today's TWIS routine for this script, if there is one. */
export async function saveBullpenSession(input: {
  playerId: string;
  scriptId: string | null;
  results: unknown;
}): Promise<{ error: string | null; checked?: boolean }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || (input.scriptId && !isUuid(input.scriptId))) return { error: "Unknown bullpen." };
  const raw = Array.isArray(input.results) ? input.results : [];
  const pitches = cleanScript(raw);
  if (typeof pitches === "string") return { error: pitches };
  const results = pitches.map((p, i) => ({ ...p, hit: Boolean((raw[i] as { hit?: unknown })?.hit) }));
  const today = todayISO();
  const supabase = await createClient();
  const { error } = await supabase.from("bullpen_sessions").insert({ player_id: input.playerId, script_id: input.scriptId, thrown_on: today, results });
  if (error) return { error: friendlyDbError(error) };

  let checked = false;
  if (input.scriptId) {
    const { data } = await supabase
      .from("player_activities")
      .select("id, days")
      .eq("player_id", input.playerId)
      .eq("bullpen_script_id", input.scriptId)
      .lte("starts_on", today)
      .or(`ends_on.is.null,ends_on.gte.${today}`);
    const routine = ((data ?? []) as { id: string; days: number[] }[]).find((r) => r.days.length === 0 || r.days.includes(isoWeekday(today)));
    if (routine) {
      const res = await setTwisCheck({ playerId: input.playerId, kind: "activity", refId: routine.id, onDate: routine.days.length ? today : weekStart(today), checked: true });
      checked = !res.error;
    }
  }
  refresh();
  return { error: null, checked };
}

const LIMITS = { opponent: 80, first_pitch: 300, out_pitch: 300, reset: 300, watch: 500, worked: 500, fix: 500 } as const;

/** Her plan for a game (before) and her look-back (after). */
export async function savePitcherPlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const denied = await actForCheck(playerId);
  if (denied) return { error: denied };
  const gameId = text(fd, "game_id");
  const planDate = text(fd, "plan_date");
  if ((gameId && !isUuid(gameId)) || !isISODate(planDate)) return { error: "Unknown game." };
  const values: Record<string, string | number | null> = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    const v = text(fd, key);
    if (v && v.length > max) return { error: `Keep each answer under ${max} characters.` };
    values[key] = v;
  }
  const pct = text(fd, "strike_pct");
  const strike = pct === null ? null : Number(pct);
  if (strike !== null && (!Number.isInteger(strike) || strike < 0 || strike > 100)) return { error: "Strike % is a whole number from 0 to 100." };
  values.strike_pct = strike;
  const supabase = await createClient();
  const row = { player_id: playerId, game_id: gameId, plan_date: planDate, ...values, updated_at: new Date().toISOString() };
  const { error } = gameId
    ? await supabase.from("pitcher_game_plans").upsert(row, { onConflict: "player_id,game_id" })
    : await supabase.from("pitcher_game_plans").insert(row);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}
