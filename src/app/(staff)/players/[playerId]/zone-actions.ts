"use server";

// My Zone (Phase 3): two versions (user, 2026-11-16). The Testing Result is a coach's (editors only);
// her Player Choice is hers or a coach's (RLS: her own "player" row, or staff).
import { refresh } from "next/cache";
import { actForCheck, editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { ZONE_NOTES_MAX, ZONE_SOURCES, cleanZones, type ZoneSource } from "@/lib/my-zone";

export async function saveHittingZones(input: {
  playerId: string;
  source: ZoneSource;
  hot: number[];
  strong: number[];
  weak: number[];
  notes: string;
}): Promise<{ error: string | null }> {
  if (!ZONE_SOURCES.includes(input.source)) return { error: "Reload the page and try again." };
  const denied = input.source === "testing" ? await editorCheck() : await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId)) return { error: "Unknown player." };
  const zones = cleanZones(input);
  const notes = (input.notes ?? "").trim();
  if (notes.length > ZONE_NOTES_MAX) return { error: `Keep the note under ${ZONE_NOTES_MAX} characters.` };
  const supabase = await createClient();
  const { error } = await supabase
    .from("hitting_zones")
    .upsert(
      { player_id: input.playerId, source: input.source, ...zones, notes: notes || null, updated_at: new Date().toISOString() },
      { onConflict: "player_id,source" },
    );
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}
