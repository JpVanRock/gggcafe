import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { compareJersey } from "@/lib/softball";
import type { BaseRunning, GameJob, HittingType, PitchPlan, Rotation, SubEntry } from "@/lib/gameday";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type GamedayPlayer = {
  id: string;
  name: string;
  /** "#7 Avery L." */
  short: string;
  number: string | null;
  positions: string[];
  hitting_type: HittingType | null;
  base_running: BaseRunning | null;
  avg: number | null;
  obp: number | null;
  k_pct: number | null;
  /** where the stats come from: box scores win; otherwise what the coach typed */
  statsFrom: "box" | "typed" | null;
  typed: { avg: number | null; obp: number | null; k_pct: number | null };
};

type RosterRow = {
  jersey_number: string | null;
  player: {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    primary_position: string | null;
    secondary_positions: string[] | null;
  } | null;
};

/** The team's active roster for a season, with GameDay cards and season batting stats. */
export async function loadGamedayRoster(supabase: Supabase, teamId: string, seasonId: string): Promise<GamedayPlayer[]> {
  const [rosterResult, profileResult, statsResult] = await Promise.all([
    supabase
      .from("roster_entries")
      .select("jersey_number, player:players(id, first_name, last_name, preferred_name, primary_position, secondary_positions)")
      .eq("team_id", teamId)
      .eq("season_id", seasonId)
      .eq("active", true),
    supabase.from("gameday_profiles").select("player_id, hitting_type, base_running, avg, obp, k_pct").eq("team_id", teamId).eq("season_id", seasonId),
    supabase.from("batting_season").select("player_id, pa, avg, obp, k_pct").eq("team_id", teamId).eq("season_id", seasonId),
  ]);
  const profiles = new Map(((profileResult.data ?? []) as { player_id: string; hitting_type: HittingType | null; base_running: BaseRunning | null; avg: number | null; obp: number | null; k_pct: number | null }[]).map((p) => [p.player_id, p]));
  const stats = new Map(((statsResult.data ?? []) as { player_id: string; pa: number; avg: number | null; obp: number | null; k_pct: number | null }[]).map((s) => [s.player_id, s]));
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return ((rosterResult.data ?? []) as unknown as RosterRow[])
    .filter((r) => r.player)
    .sort((a, b) => compareJersey(a.jersey_number, b.jersey_number) || a.player!.last_name.localeCompare(b.player!.last_name))
    .map((r) => {
      const p = r.player!;
      const first = p.preferred_name || p.first_name;
      const prof = profiles.get(p.id);
      const box = stats.get(p.id);
      const fromBox = Boolean(box && box.pa > 0);
      const typed = { avg: num(prof?.avg), obp: num(prof?.obp), k_pct: num(prof?.k_pct) };
      const shown = fromBox ? { avg: num(box!.avg), obp: num(box!.obp), k_pct: num(box!.k_pct) } : typed;
      return {
        id: p.id,
        name: `${first} ${p.last_name}`,
        short: `${r.jersey_number ? `#${r.jersey_number} ` : ""}${first} ${p.last_name.charAt(0)}.`,
        number: r.jersey_number,
        positions: [p.primary_position, ...(p.secondary_positions ?? [])].filter((x): x is string => Boolean(x)),
        hitting_type: prof?.hitting_type ?? null,
        base_running: prof?.base_running ?? null,
        ...shown,
        statsFrom: fromBox ? "box" : shown.avg !== null || shown.obp !== null || shown.k_pct !== null ? "typed" : null,
        typed,
      };
    });
}

export type Lineup = {
  id: string;
  team: { id: string; name: string };
  season_id: string | null;
  game_date: string;
  opponent: string | null;
  title: string | null;
  rotations: number;
  batting_order: string[];
  defense: Record<string, Rotation>;
  pitching: Record<string, PitchPlan>;
  notes: string | null;
  status: "draft" | "final";
  shared_at: string | null;
  /** DP/FLEX: the DP bats, the FLEX plays defense only (the extra line on the card) */
  dp_player_id: string | null;
  flex_player_id: string | null;
  jobs: GameJob[];
  sub_log: SubEntry[];
};

export async function loadLineup(supabase: Supabase, id: string): Promise<Lineup | null> {
  const { data } = await supabase
    .from("gameday_lineups")
    .select(
      "id, season_id, game_date, opponent, title, rotations, batting_order, defense, pitching, notes, status, shared_at, dp_player_id, flex_player_id, jobs, sub_log, team:teams(id, name)",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Lineup | null) ?? null;
}

/** The season a lineup uses: its own, else the team's latest season with a roster. */
export async function lineupSeason(supabase: Supabase, teamId: string, seasonId: string | null) {
  if (seasonId) return seasonId;
  const { data } = await supabase
    .from("roster_entries")
    .select("season_id, season:seasons(start_date, created_at)")
    .eq("team_id", teamId);
  const rows = (data ?? []) as unknown as { season_id: string; season: { start_date: string | null; created_at: string } | null }[];
  rows.sort((a, b) => (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? "") || (b.season?.created_at ?? "").localeCompare(a.season?.created_at ?? ""));
  return rows[0]?.season_id ?? null;
}
