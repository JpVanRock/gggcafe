"use server";

// My Zone (Phase 3): the player herself or a coach saves it (RLS: her own row, or staff).
import { refresh } from "next/cache";
import { actForCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { ZONE_NOTES_MAX, cleanZones } from "@/lib/my-zone";

export async function saveHittingZones(input: { playerId: string; hot: number[]; strong: number[]; weak: number[]; notes: string }): Promise<{ error: string | null }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId)) return { error: "Unknown player." };
  const zones = cleanZones(input);
  const notes = (input.notes ?? "").trim();
  if (notes.length > ZONE_NOTES_MAX) return { error: `Keep the note under ${ZONE_NOTES_MAX} characters.` };
  const supabase = await createClient();
  const { error } = await supabase
    .from("hitting_zones")
    .upsert({ player_id: input.playerId, ...zones, notes: notes || null, updated_at: new Date().toISOString() }, { onConflict: "player_id" });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}
