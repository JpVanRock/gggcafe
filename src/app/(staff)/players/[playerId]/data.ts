import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { addDays, formatTime, isoWeekday, weekDates } from "@/lib/dates";
import type { FieldPosition, Player, Position } from "@/lib/softball";
import type { DiamondSpec } from "@/components/diamond";
import type { TeamCulture, TeamStandard } from "@/components/team-standards";
import { HITTING_KEYS, MOVEMENT_KEYS, type Values } from "@/lib/movement";
import { MENTAL_FIELDS, type MentalPlan } from "./shared";
import { TRAINING_CATEGORY_LABEL, type Check, type Routine, type TrainingCategory } from "@/lib/achievements";

export { MENTAL_FIELDS, type MentalField, type MentalPlan } from "./shared";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// TWIS
// ---------------------------------------------------------------------------

export const EVENT_KIND_LABEL: Record<string, string> = {
  practice: "Practice",
  workout: "Workout",
  lesson: "Lesson",
  meeting: "Team meeting",
  other: "Team event",
};

export type TwisKind = "game" | "event" | "activity";

export type TwisItem = {
  key: string;
  kind: TwisKind;
  /** id of the activity, team event or game */
  refId: string;
  /** the date stored on the check-off (weekly activities use the week's Monday) */
  onDate: string;
  title: string;
  detail: string | null;
  tag: string;
  checked: boolean;
};

export type TwisCell = { key: string; date: string | null; items: TwisItem[] };

export type TwisWeek = {
  monday: string;
  cells: TwisCell[]; // Monday..Sunday, then "any day this week"
  done: number;
  total: number;
};

type GameRow = {
  id: string;
  game_date: string;
  start_time: string | null;
  venue: string | null;
  event_name: string | null;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home: { name: string; short_name: string | null } | null;
  away: { name: string; short_name: string | null } | null;
};

type EventRow = {
  id: string;
  kind: string;
  title: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
};

export type ActivityRow = {
  id: string;
  title: string;
  details: string | null;
  days: number[];
  starts_on: string;
  ends_on: string | null;
  pillar_id: string | null;
  pillar: { title: string } | null;
  category: TrainingCategory | null;
};

export async function loadTwisWeek(supabase: Supabase, playerId: string, monday: string): Promise<TwisWeek> {
  const sunday = addDays(monday, 6);

  const { data: rosterData } = await supabase
    .from("roster_entries")
    .select("team_id")
    .eq("player_id", playerId)
    .eq("active", true);
  const teamIds = [...new Set(((rosterData ?? []) as { team_id: string }[]).map((r) => r.team_id))];
  const teamList = teamIds.join(",");

  const [eventsResult, gamesResult, activitiesResult, checksResult] = await Promise.all([
    teamIds.length
      ? supabase
          .from("team_events")
          .select("id, kind, title, event_date, start_time, end_time, location")
          .in("team_id", teamIds)
          .gte("event_date", monday)
          .lte("event_date", sunday)
      : Promise.resolve({ data: [] }),
    teamIds.length
      ? supabase
          .from("games")
          .select(
            "id, game_date, start_time, venue, event_name, status, home_team_id, away_team_id, home:teams!home_team_id(name, short_name), away:teams!away_team_id(name, short_name)",
          )
          .or(`home_team_id.in.(${teamList}),away_team_id.in.(${teamList})`)
          .neq("status", "cancelled")
          .gte("game_date", monday)
          .lte("game_date", sunday)
      : Promise.resolve({ data: [] }),
    loadActivities(supabase, playerId, monday, sunday),
    supabase
      .from("twis_checks")
      .select("activity_id, team_event_id, game_id, on_date")
      .eq("player_id", playerId)
      .gte("on_date", monday)
      .lte("on_date", sunday),
  ]);

  const checked = new Set(
    ((checksResult.data ?? []) as { activity_id: string | null; team_event_id: string | null; game_id: string | null; on_date: string }[]).map(
      (c) => (c.activity_id ? `a:${c.activity_id}:${c.on_date}` : c.team_event_id ? `e:${c.team_event_id}` : `g:${c.game_id}`),
    ),
  );

  const dates = weekDates(monday);
  const byDate = new Map<string, { sort: string; item: TwisItem }[]>(dates.map((d) => [d, []]));
  const anyDay: TwisItem[] = [];

  for (const g of (gamesResult.data ?? []) as unknown as GameRow[]) {
    const home = teamIds.includes(g.home_team_id);
    const opponent = home ? g.away : g.home;
    const key = `g:${g.id}`;
    byDate.get(g.game_date)?.push({
      sort: `0${g.start_time ?? "99"}`,
      item: {
        key,
        kind: "game",
        refId: g.id,
        onDate: g.game_date,
        title: `${home ? "vs" : "@"} ${opponent?.short_name || opponent?.name || "TBD"}`,
        detail: [formatTime(g.start_time), g.event_name, g.venue].filter(Boolean).join(" · ") || null,
        tag: "Game",
        checked: checked.has(key),
      },
    });
  }

  for (const e of (eventsResult.data ?? []) as EventRow[]) {
    const key = `e:${e.id}`;
    const time = [formatTime(e.start_time), formatTime(e.end_time)].filter(Boolean).join("–");
    byDate.get(e.event_date)?.push({
      sort: `0${e.start_time ?? "99"}`,
      item: {
        key,
        kind: "event",
        refId: e.id,
        onDate: e.event_date,
        title: e.title || EVENT_KIND_LABEL[e.kind] || "Team event",
        detail: [time, e.location].filter(Boolean).join(" · ") || null,
        tag: EVENT_KIND_LABEL[e.kind] ?? "Team",
        checked: checked.has(key),
      },
    });
  }

  for (const a of activitiesResult) {
    const tag = a.category ? TRAINING_CATEGORY_LABEL[a.category].title.split(" ")[0] : (a.pillar?.title ?? "My activity");
    if (a.days.length === 0) {
      const key = `a:${a.id}:${monday}`;
      anyDay.push({ key, kind: "activity", refId: a.id, onDate: monday, title: a.title, detail: a.details, tag, checked: checked.has(key) });
      continue;
    }
    for (const d of dates) {
      if (!a.days.includes(isoWeekday(d)) || d < a.starts_on || (a.ends_on && d > a.ends_on)) continue;
      const key = `a:${a.id}:${d}`;
      byDate.get(d)?.push({
        sort: `1${a.title}`,
        item: { key, kind: "activity", refId: a.id, onDate: d, title: a.title, detail: a.details, tag, checked: checked.has(key) },
      });
    }
  }

  const cells: TwisCell[] = dates.map((d) => ({
    key: d,
    date: d,
    items: (byDate.get(d) ?? []).sort((x, y) => x.sort.localeCompare(y.sort)).map((x) => x.item),
  }));
  cells.push({ key: "any", date: null, items: anyDay });

  const all = cells.flatMap((c) => c.items);
  return { monday, cells, done: all.filter((i) => i.checked).length, total: all.length };
}

/** Activities that apply at some point between the two dates. */
export async function loadActivities(supabase: Supabase, playerId: string, from: string, to: string): Promise<ActivityRow[]> {
  const { data } = await supabase
    .from("player_activities")
    .select("id, title, details, days, starts_on, ends_on, pillar_id, category, pillar:harada_pillars(title)")
    .eq("player_id", playerId)
    .lte("starts_on", to)
    .or(`ends_on.is.null,ends_on.gte.${from}`)
    .order("created_at");
  return (data ?? []) as unknown as ActivityRow[];
}

// ---------------------------------------------------------------------------
// Goals (Harada Method)
// ---------------------------------------------------------------------------

export type HaradaAction = { id: string; position: number; title: string; done_on: string | null };
export type HaradaPillar = { id: string; position: number; title: string; actions: HaradaAction[] };
export type HaradaChart = {
  id: string;
  main_goal: string;
  purpose: string | null;
  target_date: string | null;
  pillars: HaradaPillar[];
};

export async function loadHarada(supabase: Supabase, playerId: string): Promise<HaradaChart | null> {
  const { data: plan } = await supabase
    .from("harada_plans")
    .select("id, main_goal, purpose, target_date")
    .eq("player_id", playerId)
    .eq("status", "active")
    .maybeSingle();
  if (!plan) return null;

  const { data: pillars } = await supabase
    .from("harada_pillars")
    .select("id, position, title, actions:harada_actions(id, position, title, done_on)")
    .eq("plan_id", plan.id)
    .order("position");

  return {
    ...(plan as Omit<HaradaChart, "pillars">),
    pillars: ((pillars ?? []) as HaradaPillar[]).map((p) => ({
      ...p,
      actions: [...p.actions].sort((a, b) => a.position - b.position),
    })),
  };
}

// ---------------------------------------------------------------------------
// Goals (SMART Method)
// ---------------------------------------------------------------------------

export type SmartGoal = {
  id: string;
  title: string;
  area: string;
  specific: string | null;
  measurable: string | null;
  achievable: string | null;
  relevant: string | null;
  target_date: string | null;
  status: "active" | "achieved" | "missed" | "dropped";
  achieved_on: string | null;
  metric_key: string | null;
  baseline_value: number | null;
  target_value: number | null;
  metric: { name: string; unit: string; better: "higher" | "lower" } | null;
};

export async function loadSmartGoals(supabase: Supabase, playerId: string): Promise<SmartGoal[]> {
  const { data } = await supabase
    .from("development_goals")
    .select(
      "id, title, area, specific, measurable, achievable, relevant, target_date, status, achieved_on, metric_key, baseline_value, target_value, metric:metrics(name, unit, better)",
    )
    .eq("player_id", playerId)
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("created_at");
  return (data ?? []) as unknown as SmartGoal[];
}

export type MetricOption = { key: string; name: string; unit: string };

export async function loadMetricOptions(supabase: Supabase): Promise<MetricOption[]> {
  const { data } = await supabase.from("metrics").select("key, name, unit").order("name");
  return (data ?? []) as MetricOption[];
}

// ---------------------------------------------------------------------------
// Performance Training (routines = player activities with a training category)
// ---------------------------------------------------------------------------

export type DrillInfo = {
  name: string;
  description: string;
  equipment: string | null;
  video_url: string | null;
};

export type RoutineRow = Routine & {
  title: string;
  details: string | null;
  drill: DrillInfo | null;
};

export type Performance = {
  routines: RoutineRow[];
  checks: Check[];
  library: { id: string; name: string; category: TrainingCategory | null }[];
  earned: { achievement_key: string; unlocked_on: string }[];
};

export async function loadPerformance(supabase: Supabase, playerId: string): Promise<Performance> {
  const [routinesResult, libraryResult, earnedResult] = await Promise.all([
    supabase
      .from("player_activities")
      .select("id, title, details, days, starts_on, ends_on, category, drill:drills(name, description, equipment, video_url)")
      .eq("player_id", playerId)
      .not("category", "is", null)
      .order("created_at"),
    supabase.from("drills").select("id, name, category").order("name"),
    supabase.from("player_achievements").select("achievement_key, unlocked_on").eq("player_id", playerId),
  ]);
  const routines = (routinesResult.data ?? []) as unknown as RoutineRow[];
  const ids = routines.map((r) => r.id);
  const { data: checks } = ids.length
    ? await supabase.from("twis_checks").select("activity_id, on_date").in("activity_id", ids)
    : { data: [] };
  return {
    routines,
    checks: (checks ?? []) as Check[],
    library: (libraryResult.data ?? []) as Performance["library"],
    earned: (earnedResult.data ?? []) as Performance["earned"],
  };
}

// ---------------------------------------------------------------------------
// Softball IQ (practice quizzes, level and position tests, Extra Credit)
// ---------------------------------------------------------------------------

export type IqTopic = "general" | "hitting" | "pitching" | "position";

/** Playbook tracks (Levels 1-3, rings) and the position track (one level per position, Golden Gloves). */
export type IqTrack = "defense" | "baserunning" | "position" | "extra";

export type IqQuestion = {
  id: string;
  topic: IqTopic;
  position: Position | null;
  track: IqTrack | null;
  level: number | null;
  /** Extra Credit Library shelf */
  section: string | null;
  diagram: DiamondSpec | null;
  scenario: string;
  question: string;
  choices: string[];
  /** from iq_answer_key(): every question for staff; for a player, only ones she has answered (else -1) */
  correct_index: number;
  explanation: string | null;
  difficulty: number;
  active: boolean;
};

export type IqAnswer = {
  question_id: string;
  is_correct: boolean;
  answered_on: string;
  created_at: string;
  attempt_id: string | null;
  review_of: string | null;
};

export async function loadIq(supabase: Supabase, playerId: string) {
  const [questionsResult, answersResult, keyResult] = await Promise.all([
    supabase
      .from("iq_questions")
      .select("id, topic, position, track, level, section, diagram, scenario, question, choices, difficulty, active")
      .order("topic")
      .order("position", { nullsFirst: true })
      .order("created_at"),
    supabase
      .from("iq_answers")
      .select("question_id, is_correct, answered_on, created_at, attempt_id, review_of")
      .eq("player_id", playerId)
      // newest first so the API's row cap drops the oldest answers, then put back in time order
      .order("created_at", { ascending: false })
      .limit(1000),
    // Answer keys aren't readable directly; this returns what the viewer may see.
    supabase.rpc("iq_answer_key", { p_player_id: playerId }),
  ]);
  const key = new Map(
    ((keyResult.data ?? []) as { question_id: string; correct_index: number; explanation: string | null }[]).map((k) => [k.question_id, k]),
  );
  const [ringsResult, glovesResult, mvpResult, trophyResult, attemptsResult] = await Promise.all([
    supabase.from("player_rings").select("track, level, earned_on").eq("player_id", playerId),
    supabase.from("player_golden_gloves").select("position, earned_on").eq("player_id", playerId),
    supabase.from("player_mvp_badges").select("track, level, position, earned_on").eq("player_id", playerId).order("earned_on"),
    // the GGG Champions Trophy (table named for its original "World Series" name)
    supabase.from("player_world_series_trophies").select("earned_on").eq("player_id", playerId).maybeSingle(),
    supabase
      .from("iq_level_attempts")
      .select("id, track, level, position, correct, total, passed, started_at, finished_at, reviewed_at, question_order")
      .eq("player_id", playerId)
      .order("started_at", { ascending: false }),
  ]);
  return {
    questions: ((questionsResult.data ?? []) as Omit<IqQuestion, "correct_index" | "explanation">[]).map((q) => ({
      ...q,
      correct_index: key.get(q.id)?.correct_index ?? -1,
      explanation: key.get(q.id)?.explanation ?? null,
    })),
    answers: ((answersResult.data ?? []) as IqAnswer[]).reverse(),
    rings: (ringsResult.data ?? []) as { track: "defense" | "baserunning"; level: number; earned_on: string }[],
    gloves: (glovesResult.data ?? []) as { position: FieldPosition; earned_on: string }[],
    mvps: (mvpResult.data ?? []) as { track: IqTrack; level: number; position: FieldPosition | null; earned_on: string }[],
    championsTrophy: (trophyResult.data ?? null) as { earned_on: string } | null,
    attempts: (attemptsResult.data ?? []) as IqAttempt[],
  };
}

export type IqAttempt = {
  id: string;
  track: IqTrack;
  level: number;
  position: FieldPosition | null;
  correct: number | null;
  total: number | null;
  passed: boolean | null;
  started_at: string;
  finished_at: string | null;
  reviewed_at: string | null;
  question_order: string[] | null;
};

export type IqData = Awaited<ReturnType<typeof loadIq>>;

// ---------------------------------------------------------------------------
// Mental GP
// ---------------------------------------------------------------------------

export async function loadMentalPlan(supabase: Supabase, playerId: string): Promise<MentalPlan | null> {
  const { data } = await supabase
    .from("mental_game_plans")
    .select(`${MENTAL_FIELDS.map((f) => f.name).join(", ")}, updated_at`)
    .eq("player_id", playerId)
    .maybeSingle();
  return (data as MentalPlan | null) ?? null;
}

// ---------------------------------------------------------------------------
// Pop Report
// ---------------------------------------------------------------------------

export type Rostering = {
  id: string;
  jersey_number: string | null;
  active: boolean;
  team: { id: string; name: string; short_name: string | null; is_own_team: boolean; logo_url: string | null } | null;
  season: { name: string; start_date: string | null } | null;
};

export type MetricProgress = {
  metric_key: string;
  metric_name: string;
  unit: string;
  better: "higher" | "lower";
  measurements: number;
  first_value: number | null;
  latest_value: number | null;
  latest_measured_on: string | null;
  best_value: number | null;
  improvement: number | null;
};

export type Evaluation = { area: string; rating: number; evaluated_on: string; comments: string | null };

export type PopReport = {
  rosters: Rostering[];
  metrics: MetricProgress[];
  evaluations: Evaluation[]; // latest per skill area
};

export async function loadPopReport(supabase: Supabase, playerId: string): Promise<PopReport> {
  const [rosterResult, metricsResult, evalResult] = await Promise.all([
    supabase
      .from("roster_entries")
      .select("id, jersey_number, active, team:teams(id, name, short_name, is_own_team, logo_url), season:seasons(name, start_date)")
      .eq("player_id", playerId),
    supabase.from("player_metric_progress").select("*").eq("player_id", playerId).order("metric_name"),
    supabase
      .from("skill_evaluations")
      .select("area, rating, evaluated_on, comments")
      .eq("player_id", playerId)
      .order("evaluated_on", { ascending: false }),
  ]);

  const latestByArea = new Map<string, Evaluation>();
  for (const e of (evalResult.data ?? []) as Evaluation[]) {
    if (!latestByArea.has(e.area)) latestByArea.set(e.area, e);
  }

  return {
    rosters: ((rosterResult.data ?? []) as unknown as Rostering[]).sort((a, b) =>
      (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? ""),
    ),
    metrics: (metricsResult.data ?? []) as MetricProgress[],
    evaluations: [...latestByArea.values()],
  };
}

export function currentRostering(pop: PopReport) {
  return pop.rosters.find((r) => r.active && r.team?.is_own_team) ?? pop.rosters[0] ?? null;
}

export function firstName(p: Pick<Player, "first_name" | "preferred_name">) {
  return p.preferred_name || p.first_name;
}

/** "Avery's", "Chris'" */
export function possessive(name: string) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// ---------------------------------------------------------------------------
// From the Dugout: Team Standards and Team Culture for her active teams
// ---------------------------------------------------------------------------

export type TeamDugout = {
  team: { id: string; name: string };
  culture: TeamCulture | null;
  standards: TeamStandard[];
};

export async function loadTeamDugout(supabase: Supabase, playerId: string): Promise<TeamDugout[]> {
  const { data: rosterData } = await supabase
    .from("roster_entries")
    .select("team:teams(id, name, is_own_team)")
    .eq("player_id", playerId)
    .eq("active", true);
  const teams = new Map<string, { id: string; name: string }>();
  for (const r of (rosterData ?? []) as unknown as { team: { id: string; name: string; is_own_team: boolean } | null }[]) {
    if (r.team?.is_own_team) teams.set(r.team.id, { id: r.team.id, name: r.team.name });
  }
  if (teams.size === 0) return [];

  const ids = [...teams.keys()];
  const [cultureResult, standardsResult] = await Promise.all([
    supabase.from("team_culture").select("team_id, headline, statement").in("team_id", ids),
    supabase.from("team_standards").select("team_id, title, detail").in("team_id", ids).order("position"),
  ]);
  const cultures = (cultureResult.data ?? []) as (TeamCulture & { team_id: string })[];
  const standards = (standardsResult.data ?? []) as (TeamStandard & { team_id: string })[];

  return [...teams.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((team) => {
      const c = cultures.find((x) => x.team_id === team.id);
      return {
        team,
        culture: c ? { headline: c.headline, statement: c.statement } : null,
        standards: standards.filter((s) => s.team_id === team.id).map(({ title, detail }) => ({ title, detail })),
      };
    });
}

// ---------------------------------------------------------------------------
// Movement Preferences and Preferred Hitting Style (versioned: newest first)
// ---------------------------------------------------------------------------

export type StyleVersion = { id: string; recorded_at: string; by: string; values: Values };

export async function loadMovementAndHitting(supabase: Supabase, playerId: string) {
  const [movementResult, hittingResult] = await Promise.all([
    supabase.from("movement_preferences").select("*").eq("player_id", playerId).order("recorded_at", { ascending: false }).limit(50),
    supabase.from("hitting_styles").select("*").eq("player_id", playerId).order("recorded_at", { ascending: false }).limit(50),
  ]);
  type Row = Record<string, string | null> & { id: string; recorded_at: string; recorded_by: string | null };
  const movementRows = (movementResult.data ?? []) as Row[];
  const hittingRows = (hittingResult.data ?? []) as Row[];
  const authorIds = [...new Set([...movementRows, ...hittingRows].map((r) => r.recorded_by).filter((id): id is string => Boolean(id)))];
  const { data: authors } = authorIds.length
    ? await supabase.rpc("change_authors", { p_user_ids: authorIds })
    : { data: [] };
  const names = new Map(((authors ?? []) as { user_id: string; name: string }[]).map((a) => [a.user_id, a.name]));
  const version = (keys: string[]) => (r: Row): StyleVersion => ({
    id: r.id,
    recorded_at: r.recorded_at,
    by: (r.recorded_by && names.get(r.recorded_by)) || "Coach",
    values: Object.fromEntries(keys.map((k) => [k, r[k] ?? null])),
  });
  return { movement: movementRows.map(version(MOVEMENT_KEYS)), hitting: hittingRows.map(version(HITTING_KEYS)) };
}
