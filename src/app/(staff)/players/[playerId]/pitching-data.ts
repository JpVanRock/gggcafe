import "server-only";
// Pitching (Phase 4): her team's bullpen scripts, her bullpen sessions and her game plans.
import type { createClient } from "@/lib/supabase/server";
import type { ResultPitch, ScriptPitch } from "@/lib/bullpen";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type BullpenScript = { id: string; name: string; notes: string | null; pitches: ScriptPitch[] };
export type BullpenSession = { id: string; script_id: string | null; thrown_on: string; results: ResultPitch[] };
export type GamePlan = {
  id: string;
  game_id: string | null;
  plan_date: string;
  opponent: string | null;
  first_pitch: string | null;
  out_pitch: string | null;
  reset: string | null;
  watch: string | null;
  worked: string | null;
  fix: string | null;
  strike_pct: number | null;
};

async function teamIds(supabase: Supabase, playerId: string) {
  const { data } = await supabase.from("roster_entries").select("team_id").eq("player_id", playerId).eq("active", true);
  return [...new Set(((data ?? []) as { team_id: string }[]).map((r) => r.team_id))];
}

export async function loadBullpens(supabase: Supabase, playerId: string) {
  const teams = await teamIds(supabase, playerId);
  const [scripts, sessions] = await Promise.all([
    teams.length ? supabase.from("bullpen_scripts").select("id, name, notes, pitches").in("team_id", teams).order("name") : Promise.resolve({ data: [] }),
    supabase.from("bullpen_sessions").select("id, script_id, thrown_on, results").eq("player_id", playerId).order("thrown_on", { ascending: false }).order("created_at", { ascending: false }).limit(40),
  ]);
  return { scripts: (scripts.data ?? []) as BullpenScript[], sessions: (sessions.data ?? []) as BullpenSession[] };
}

export type PlanGame = { id: string; game_date: string; opponent: string };

/** Her games from two weeks back to two weeks ahead, and her plans. */
export async function loadGamePlans(supabase: Supabase, playerId: string, from: string, to: string) {
  const teams = await teamIds(supabase, playerId);
  const list = teams.join(",");
  const [games, plans] = await Promise.all([
    teams.length
      ? supabase
          .from("games")
          .select("id, game_date, home_team_id, away_team_id, home:teams!home_team_id(name), away:teams!away_team_id(name)")
          .or(`home_team_id.in.(${list}),away_team_id.in.(${list})`)
          .neq("status", "cancelled")
          .gte("game_date", from)
          .lte("game_date", to)
          .order("game_date")
      : Promise.resolve({ data: [] }),
    supabase
      .from("pitcher_game_plans")
      .select("id, game_id, plan_date, opponent, first_pitch, out_pitch, reset, watch, worked, fix, strike_pct")
      .eq("player_id", playerId)
      .order("plan_date", { ascending: false })
      .limit(30),
  ]);
  const rows = (games.data ?? []) as unknown as { id: string; game_date: string; home_team_id: string; home: { name: string } | null; away: { name: string } | null }[];
  return {
    games: rows.map((g) => ({ id: g.id, game_date: g.game_date, opponent: (teams.includes(g.home_team_id) ? g.away?.name : g.home?.name) ?? "Opponent" })) as PlanGame[],
    plans: (plans.data ?? []) as GamePlan[],
  };
}
