// Leader Badge (G3 Leadership Guide certificate): which players earned it. The
// certificates' RLS shows them only to coaches/admins and the player herself, so
// anyone else gets an empty set.
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadLeaderBadges(supabase: Supabase, playerIds: string[]): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();
  const { data } = await supabase.from("player_leadership_certificates").select("player_id").in("player_id", playerIds);
  return new Set(((data ?? []) as { player_id: string }[]).map((r) => r.player_id));
}
