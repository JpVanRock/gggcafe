"use server";

// Pop Report: Movement Preferences and Preferred Hitting Style.
import { refresh } from "next/cache";
import { actForCheck, editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { HITTING, HITTING_KEYS, MOVEMENT, MOVEMENT_KEYS, changes, cleanValues, type Values } from "@/lib/movement";

// ---------------------------------------------------------------------------
// Movement Preferences (coaches) and Preferred Hitting Style (player or coach).
// Every save is a new version, so the history is kept.
// ---------------------------------------------------------------------------

function formValues(fd: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, text(fd, k)]));
}

export async function saveMovement(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const values = cleanValues(MOVEMENT, formValues(fd, MOVEMENT_KEYS));
  const supabase = await createClient();
  // Movement Preferences is G3 Advanced (user, 2026-11-08)
  const { data: g3 } = await supabase.from("player_advanced_access").select("player_id").eq("player_id", playerId).maybeSingle();
  if (!g3) return { error: "Movement Preferences is a G3 Advanced feature. An admin unlocks G3 Advanced for her first (Coaches Dugout → Roster)." };
  const { data: latest } = await supabase
    .from("movement_preferences")
    .select("*") // compared on MOVEMENT_KEYS only (a built column list can't be typed)
    .eq("player_id", playerId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && changes(MOVEMENT, latest as Values, values).length === 0) return { error: null, saved: true };
  const { error } = await supabase.from("movement_preferences").insert({ player_id: playerId, ...values });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function saveHittingStyle(_prev: FormState, fd: FormData): Promise<FormState> {
  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const denied = await actForCheck(playerId);
  if (denied) return { error: denied };
  const values = cleanValues(HITTING, formValues(fd, HITTING_KEYS));
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("hitting_styles")
    .select("*") // compared on HITTING_KEYS only (a built column list can't be typed)
    .eq("player_id", playerId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && changes(HITTING, latest as Values, values).length === 0) return { error: null, saved: true };
  const { error } = await supabase.from("hitting_styles").insert({ player_id: playerId, ...values });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}
