import "server-only";
// Rosters in one place: a team's current season, its active players, and the teams a
// player is on. Every page that lists a team's players builds on loadRoster(), so they
// all agree on who is on the team (user, roadmap step 2).
import type { createClient } from "@/lib/supabase/server";
import { compareJersey, playerName } from "@/lib/softball";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RosterPlayer = {
  id: string;
  /** "Avery Lopez" (preferred first name) */
  name: string;
  /** "#7 Avery L." for chips and compact lists */
  short: string;
  /** jersey number */
  number: string | null;
  primary: string | null;
  /** primary first, then secondary positions */
  positions: string[];
};

type PlayerBits = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  primary_position: string | null;
  secondary_positions: string[] | null;
};

const PLAYER_COLUMNS = "id, first_name, last_name, preferred_name, primary_position, secondary_positions";

export function toRosterPlayer(p: PlayerBits, number: string | null): RosterPlayer {
  const first = p.preferred_name || p.first_name;
  return {
    id: p.id,
    name: playerName(p),
    short: `${number ? `#${number} ` : ""}${first} ${p.last_name.charAt(0)}.`,
    number,
    primary: p.primary_position,
    positions: [p.primary_position, ...(p.secondary_positions ?? [])].filter((x): x is string => Boolean(x)),
  };
}

/** The team's current season: its latest season with a roster (the database's own rule, private.team_current_season). */
export async function currentSeason(supabase: Supabase, teamId: string): Promise<string | null> {
  const { data } = await supabase.rpc("team_current_season", { p_team_id: teamId });
  return data ?? null;
}

/** The given season, else the team's current one. */
export async function seasonOrCurrent(supabase: Supabase, teamId: string, seasonId: string | null | undefined): Promise<string | null> {
  return seasonId ?? currentSeason(supabase, teamId);
}

/**
 * The team's active players for a season (default: its current season), by jersey number
 * then last name, or by name with `order: "name"`.
 */
export async function loadRoster(
  supabase: Supabase,
  teamId: string,
  {
    seasonId,
    order = "jersey",
    teamAdmin = false,
  }: {
    seasonId?: string | null;
    order?: "jersey" | "name";
    /** a team admin (a parent, user 2026-11-12) reads names, numbers and positions only, through team_admin_roster() */
    teamAdmin?: boolean;
  } = {},
): Promise<RosterPlayer[]> {
  const season = await seasonOrCurrent(supabase, teamId, seasonId);
  if (!season) return [];
  let rows: { jersey_number: string | null; player: PlayerBits }[];
  if (teamAdmin) {
    const { data } = await supabase.rpc("team_admin_roster", { p_team_id: teamId, p_season_id: season });
    rows = (data ?? []).map((r) => ({ jersey_number: r.jersey_number, player: r }));
  } else {
    const { data } = await supabase
      .from("roster_entries")
      .select("jersey_number, player:players(id, first_name, last_name, preferred_name, primary_position, secondary_positions)")
      .eq("team_id", teamId)
      .eq("season_id", season)
      .eq("active", true);
    rows = (data ?? []).filter((r): r is typeof r & { player: PlayerBits } => Boolean(r.player));
  }
  const players = rows.map((r) => ({ last: r.player.last_name, p: toRosterPlayer(r.player, r.jersey_number) }));
  players.sort((a, b) =>
    order === "name" ? a.p.name.localeCompare(b.p.name) : compareJersey(a.p.number, b.p.number) || a.last.localeCompare(b.last),
  );
  return players.map((x) => x.p);
}

/** Players by id (for people no longer on the roster who still appear somewhere), as roster players without a number. */
export async function loadPlayersById(supabase: Supabase, ids: string[]): Promise<RosterPlayer[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from("players").select(PLAYER_COLUMNS).in("id", ids);
  return (data ?? []).map((p) => toRosterPlayer(p, null));
}

export type PlayerTeam = { id: string; name: string; is_own_team: boolean; age_group: string | null };

/** The teams a player is active on (any season), each once. */
export async function activeTeams(supabase: Supabase, playerId: string): Promise<PlayerTeam[]> {
  const { data } = await supabase
    .from("roster_entries")
    .select("team:teams(id, name, is_own_team, age_group)")
    .eq("player_id", playerId)
    .eq("active", true);
  const teams = new Map<string, PlayerTeam>();
  for (const r of data ?? []) if (r.team) teams.set(r.team.id, r.team);
  return [...teams.values()];
}

/** Just the ids of the teams a player is active on. */
export async function activeTeamIds(supabase: Supabase, playerId: string): Promise<string[]> {
  const { data } = await supabase.from("roster_entries").select("team_id").eq("player_id", playerId).eq("active", true);
  return [...new Set((data ?? []).map((r) => r.team_id))];
}
