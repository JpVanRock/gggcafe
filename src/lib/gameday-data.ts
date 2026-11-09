import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { BaseRunning, GameJob, HittingType, PitchPlan, Rotation, SubEntry } from "@/lib/gameday";
import { loadRoster, type RosterPlayer } from "@/lib/roster";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type GamedayPlayer = RosterPlayer & {
  hitting_type: HittingType | null;
  base_running: BaseRunning | null;
  avg: number | null;
  obp: number | null;
  k_pct: number | null;
  /** where the stats come from: box scores win; otherwise what the coach typed */
  statsFrom: "box" | "typed" | null;
  typed: { avg: number | null; obp: number | null; k_pct: number | null };
};

/** The team's active roster for a season, with GameDay cards and season batting stats. */
export async function loadGamedayRoster(supabase: Supabase, teamId: string, seasonId: string): Promise<GamedayPlayer[]> {
  const [roster, profileResult, statsResult] = await Promise.all([
    loadRoster(supabase, teamId, { seasonId }),
    supabase.from("gameday_profiles").select("player_id, hitting_type, base_running, avg, obp, k_pct").eq("team_id", teamId).eq("season_id", seasonId),
    supabase.from("batting_season").select("player_id, pa, avg, obp, k_pct").eq("team_id", teamId).eq("season_id", seasonId),
  ]);
  const profiles = new Map((profileResult.data ?? []).map((p) => [p.player_id, p]));
  const stats = new Map((statsResult.data ?? []).map((s) => [s.player_id, s]));
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return roster.map((p) => {
    const prof = profiles.get(p.id);
    const box = stats.get(p.id);
    const fromBox = Boolean(box && (box.pa ?? 0) > 0);
    const typed = { avg: num(prof?.avg), obp: num(prof?.obp), k_pct: num(prof?.k_pct) };
    const shown = fromBox ? { avg: num(box!.avg), obp: num(box!.obp), k_pct: num(box!.k_pct) } : typed;
    return {
      ...p,
      hitting_type: (prof?.hitting_type ?? null) as HittingType | null,
      base_running: (prof?.base_running ?? null) as BaseRunning | null,
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
  return (data as Lineup | null) ?? null;
}


