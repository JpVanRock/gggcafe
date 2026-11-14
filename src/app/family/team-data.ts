import "server-only";
// The team on the family page (user, 2026-11-13): what's coming up on the calendar, the team's
// standards, culture and season goals, and each daughter's goals and team commitment. Parents
// read these through the "(parent view)" rules: the same reads as View as player.
import type { createClient } from "@/lib/supabase/server";
import type { TeamCulture, TeamStandard } from "@/components/team-standards";
import { pledgeLine, type TeamGoal } from "@/lib/culture";
import { addDays, todayISO } from "@/lib/dates";
import { EVENT_KIND_LABEL } from "@/lib/dugout";
import { comingUp, type ComingUpItem } from "@/lib/family";
import type { GoalMethod } from "@/lib/softball";
import { loadHarada, loadSmartGoals, type HaradaChart, type MetricProgress, type SmartGoal } from "@/app/(staff)/players/[playerId]/data";
import { loadTeamExtras } from "@/app/(staff)/players/[playerId]/team-culture-data";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type FamilyTeam = { id: string; name: string };

/** How far ahead "Coming up" looks. */
export const COMING_UP_DAYS = 21;

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** The next practices, events and games for these teams (three weeks ahead), soonest first. */
export async function loadComingUp(supabase: Supabase, teams: FamilyTeam[], limit = 8): Promise<ComingUpItem[]> {
  if (!teams.length) return [];
  const ids = teams.map((t) => t.id);
  const from = todayISO();
  const to = addDays(from, COMING_UP_DAYS);
  const [events, games] = await Promise.all([
    supabase
      .from("team_events")
      .select("id, team_id, kind, title, event_date, start_time, location")
      .in("team_id", ids)
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date")
      .limit(60),
    supabase
      .from("games")
      .select("id, game_date, start_time, venue, event_name, home_team_id, away_team_id, home:teams!home_team_id(name, short_name), away:teams!away_team_id(name, short_name)")
      .or(`home_team_id.in.(${ids.join(",")}),away_team_id.in.(${ids.join(",")})`)
      .gte("game_date", from)
      .lte("game_date", to)
      .limit(60),
  ]);
  const items: ComingUpItem[] = [
    ...(events.data ?? []).map((e) => ({
      key: `event-${e.id}`,
      teamId: e.team_id,
      date: e.event_date,
      start: hhmm(e.start_time),
      title: e.title || EVENT_KIND_LABEL[e.kind],
      place: e.location,
      game: false,
    })),
    ...(games.data ?? []).map((g) => {
      const home = ids.includes(g.home_team_id);
      const opponent = home ? g.away : g.home;
      return {
        key: `game-${g.id}`,
        teamId: home ? g.home_team_id : g.away_team_id,
        date: g.game_date,
        start: hhmm(g.start_time),
        title: `${home ? "vs" : "@"} ${opponent?.short_name || opponent?.name || "TBD"}`,
        place: [g.event_name, g.venue].filter(Boolean).join(" · ") || null,
        game: true,
      };
    }),
  ];
  return comingUp(items, limit);
}

export type FamilyTeamCulture = { team: FamilyTeam; standards: TeamStandard[]; culture: TeamCulture | null; goals: TeamGoal[] };

/** Each team's standards, culture statement and season goals (the player's Team page shows the same). */
export async function loadTeamCulture(supabase: Supabase, teams: FamilyTeam[]): Promise<FamilyTeamCulture[]> {
  if (!teams.length) return [];
  const ids = teams.map((t) => t.id);
  const [cultures, standards, goals] = await Promise.all([
    supabase.from("team_culture").select("team_id, headline, statement, motto").in("team_id", ids),
    supabase.from("team_standards").select("team_id, title, detail").in("team_id", ids).order("position"),
    supabase.from("team_goals").select("id, team_id, phase, title, target, current, unit, achieved_at, position, created_at").in("team_id", ids),
  ]);
  return teams.map((team) => {
    const c = (cultures.data ?? []).find((x) => x.team_id === team.id);
    return {
      team,
      standards: (standards.data ?? []).filter((s) => s.team_id === team.id).map(({ title, detail }) => ({ title, detail })),
      culture: c ? { headline: c.headline, statement: c.statement, motto: c.motto } : null,
      goals: ((goals.data ?? []) as (TeamGoal & { team_id: string })[])
        .filter((g) => g.team_id === team.id)
        .map((g) => ({ ...g, target: g.target === null ? null : Number(g.target), current: g.current === null ? null : Number(g.current) })),
    };
  });
}

export type DaughterGoals = {
  method: GoalMethod;
  chart: HaradaChart | null;
  smart: SmartGoal[];
  metrics: MetricProgress[];
  /** her commitment for each team's current season */
  pledges: { team: FamilyTeam; line: string; signedName: string | null; signedAt: string | null }[];
};

/** Her goals (Harada chart or SMART goals) and her team pledges, read only. */
export async function loadDaughterGoals(supabase: Supabase, playerId: string, teams: FamilyTeam[]): Promise<DaughterGoals> {
  const [{ data: player }, chart, smart, { data: metrics }, extras] = await Promise.all([
    supabase.from("players").select("goal_method").eq("id", playerId).maybeSingle(),
    loadHarada(supabase, playerId),
    loadSmartGoals(supabase, playerId),
    supabase.from("player_metric_progress").select("*").eq("player_id", playerId).order("metric_name"),
    loadTeamExtras(supabase, playerId, teams.map((t) => t.id)),
  ]);
  return {
    method: player?.goal_method ?? "harada",
    chart,
    smart,
    metrics: (metrics ?? []) as MetricProgress[],
    pledges: teams.flatMap((team) => {
      const p = extras.pledges.get(team.id);
      return p ? [{ team, line: pledgeLine(p.lines), signedName: p.signed_name, signedAt: p.signed_at }] : [];
    }),
  };
}
