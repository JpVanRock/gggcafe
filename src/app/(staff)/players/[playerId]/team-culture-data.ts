import "server-only";
// Phase 5 on her Team page: season goals, her pledge for each team's current season,
// and the team's spotlights.
import type { createClient } from "@/lib/supabase/server";
import { lineupSeason } from "@/lib/gameday-data";
import type { TeamGoal } from "@/lib/culture";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SpotlightRow = { id: string; team_id: string; player_name: string; jersey: string | null; headline: string; body: string; published_on: string };
export type PledgeRow = { team_id: string; lines: Record<string, string>; signed_name: string | null; signed_at: string | null };

export async function loadTeamExtras(supabase: Supabase, playerId: string, teamIds: string[]) {
  const goals = new Map<string, TeamGoal[]>();
  const pledges = new Map<string, PledgeRow>();
  const spotlights = new Map<string, SpotlightRow[]>();
  if (teamIds.length === 0) return { goals, pledges, spotlights };
  const seasons = await Promise.all(teamIds.map((t) => lineupSeason(supabase, t, null)));
  const [goalRows, pledgeRows, spotRows] = await Promise.all([
    supabase.from("team_goals").select("id, team_id, phase, title, target, current, unit, achieved_at, position").in("team_id", teamIds),
    supabase.from("team_pledges").select("team_id, season_id, lines, signed_name, signed_at").eq("player_id", playerId).in("team_id", teamIds),
    supabase.from("player_spotlights").select("id, team_id, player_name, jersey, headline, body, published_on").in("team_id", teamIds).order("published_on", { ascending: false }).limit(12),
  ]);
  for (const g of (goalRows.data ?? []) as (TeamGoal & { team_id: string })[]) {
    const row = { ...g, target: g.target === null ? null : Number(g.target), current: g.current === null ? null : Number(g.current) };
    goals.set(g.team_id, [...(goals.get(g.team_id) ?? []), row]);
  }
  for (const p of (pledgeRows.data ?? []) as (PledgeRow & { season_id: string })[]) {
    if (seasons[teamIds.indexOf(p.team_id)] === p.season_id) pledges.set(p.team_id, p);
  }
  for (const s of (spotRows.data ?? []) as SpotlightRow[]) spotlights.set(s.team_id, [...(spotlights.get(s.team_id) ?? []), s]);
  return { goals, pledges, spotlights };
}
