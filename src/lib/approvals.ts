import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { compareJersey, playerName } from "@/lib/softball";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ClaimRow = {
  claim_id: string;
  email: string;
  typed_name: string;
  typed_jersey: string | null;
  roster_entry_id: string | null;
  status: "pending" | "approved" | "declined";
  season_id: string;
  season_name: string;
  requested_at: string;
};
/** A roster spot a player's claim can be matched to. */
export type SpotOption = { id: string; season_id: string; player_id: string; label: string };

export type ParentLinkRow = {
  link_id: string;
  parent_name: string;
  email: string | null;
  child_name: string;
  player_id: string | null;
  status: "pending" | "approved" | "declined";
  requested_at: string;
};
/** A player a parent request can be matched to (with name keys for guessing). */
export type ParentMatch = { id: string; label: string; keys: string[] };

type SpotRow = {
  id: string;
  season_id: string;
  jersey_number: string | null;
  active: boolean;
  season: { start_date: string | null } | null;
  player: { id: string; first_name: string; last_name: string; preferred_name: string | null } | null;
};

export const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Everything to review for a team: player claims (with spots) and parent requests (with players). Coaches only. */
export async function loadTeamApprovals(supabase: Supabase, teamId: string) {
  const [claimsResult, linksResult, spotsResult] = await Promise.all([
    supabase.rpc("team_player_claims", { p_team_id: teamId }),
    supabase.rpc("team_parent_links", { p_team_id: teamId }),
    supabase
      .from("roster_entries")
      .select("id, season_id, jersey_number, active, season:seasons(start_date), player:players(id, first_name, last_name, preferred_name)")
      .eq("team_id", teamId),
  ]);
  const rows = ((spotsResult.data ?? []) as unknown as SpotRow[]).filter((r) => r.player);
  const label = (r: SpotRow) => `${r.jersey_number ? `#${r.jersey_number} ` : ""}${playerName(r.player!)}`;
  const spots: SpotOption[] = rows
    .map((r) => ({ id: r.id, season_id: r.season_id, player_id: r.player!.id, label: label(r) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  // Parents match to players on the active roster, latest season first, once each.
  const seen = new Set<string>();
  const parentPlayers: ParentMatch[] = rows
    .filter((r) => r.active)
    .sort((a, b) => (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? "") || compareJersey(a.jersey_number, b.jersey_number))
    .filter((r) => !seen.has(r.player!.id) && seen.add(r.player!.id))
    .map((r) => ({
      id: r.player!.id,
      label: label(r),
      keys: [nameKey(`${r.player!.first_name}${r.player!.last_name}`), nameKey(`${r.player!.preferred_name ?? ""}${r.player!.last_name}`)],
    }));

  return {
    claims: (claimsResult.data ?? []) as ClaimRow[],
    spots,
    parentLinks: (linksResult.data ?? []) as ParentLinkRow[],
    parentPlayers,
  };
}
