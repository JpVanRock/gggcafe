"use server";

// + Activity and the Offseason Training Leaderboard: she (or a coach) logs and
// removes sessions (the team's offseason dates are set on the Dugout Calendar).
// The database enforces it too (her own sessions only, the last seven days, four a day).
import { refresh } from "next/cache";
import { actForCheck, editorCheck } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { friendlyDbError } from "@/lib/form";
import { cleanLog, POINTS } from "@/lib/leaderboard";
import { isUuid } from "@/lib/softball";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null; points?: number };

export async function logSession(input: { playerId: string; kind: string; date: string; note?: string }): Promise<Result> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId)) return { error: "Unknown player." };
  const log = cleanLog(input, todayISO());
  if (typeof log === "string") return { error: log };
  const supabase = await createClient();
  const { error } = await supabase
    .from("training_logs")
    .insert({ player_id: input.playerId, kind: log.kind, logged_on: log.date, note: log.note });
  if (error) return { error: error.code === "P0001" ? error.message : friendlyDbError(error) };
  refresh();
  return { error: null, points: POINTS[log.kind] };
}

export async function deleteSession(input: { playerId: string; id: string }): Promise<Result> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !isUuid(input.id)) return { error: "Unknown session." };
  const supabase = await createClient();
  const { error } = await supabase.from("training_logs").delete().eq("id", input.id).eq("player_id", input.playerId);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/** Coaches: a session on the board that shouldn't be there. */
export async function removeTeamSession(input: { id: string }): Promise<Result> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.id)) return { error: "Unknown session." };
  const supabase = await createClient();
  const { error } = await supabase.from("training_logs").delete().eq("id", input.id);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}
