import "server-only";
import { notFound } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";
import { isUuid, playerName, type Player } from "@/lib/softball";
import { currentRostering, firstName, type PopReport } from "./data";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The player row for a section page (404 if it doesn't exist or isn't visible). */
export async function loadPlayer(supabase: Supabase, playerId: string): Promise<Player> {
  if (!isUuid(playerId)) notFound();
  const { data } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
  if (!data) notFound();
  return data as Player;
}

export function positionsOf(player: Player) {
  return [player.primary_position, ...player.secondary_positions].filter((p): p is NonNullable<typeof p> => Boolean(p));
}

/** Name and jersey number engraved on awards. */
export function plateFor(player: Player, pop: PopReport) {
  return { name: playerName(player), number: currentRostering(pop)?.jersey_number ?? null };
}

export { firstName };
