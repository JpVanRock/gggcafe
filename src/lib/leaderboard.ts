// Offseason Training Leaderboard: points, session types, ranking and the Player
// of the Week race. The database decides points and Players of the Week
// (public.team_leaderboard, migration 20261108124500); these values mirror it for
// the page. Change both together. No imports, so it runs in unit tests.

/** Points (user, 2026-11-08). */
export const POINTS = { unlock: 3, training: 3, workout: 5, lesson: 7 } as const;
/** Player of the Week needs at least this many points that week. */
export const POTW_MIN = 10;
/** A player can be named once every six weeks. */
export const POTW_COOLDOWN_WEEKS = 6;
/** + Activity: how far back she can log. */
export const LOG_DAYS_BACK = 7;
export const LOG_NOTE_MAX = 300;

export type SessionKind = "training" | "workout" | "lesson";

export const SESSION_KINDS: { kind: SessionKind; label: string; hint: string; points: number }[] = [
  { kind: "training", label: "Training session", hint: "Tee work, bullpen, fielding reps, drills", points: POINTS.training },
  { kind: "workout", label: "Workout", hint: "Lifting, conditioning, speed and agility", points: POINTS.workout },
  { kind: "lesson", label: "Private lesson", hint: "A hitting, pitching or position lesson", points: POINTS.lesson },
];

export function sessionLabel(kind: string) {
  return SESSION_KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

export type LeaderRow = {
  player_id: string;
  jersey_number: string | null;
  first_name: string;
  last_name: string;
  training: number;
  workouts: number;
  lessons: number;
  unlocks: number;
  points: number;
  week_points: number;
  times_named: number;
  last_named: string | null;
};

export type PotwWeek = { week_start: string; player_id: string | null; points: number; round: number; first_name: string | null; last_name: string | null };

export type LeaderboardData = {
  offseason: { starts_on: string; ends_on: string | null } | null;
  today: string;
  week_start?: string;
  players: LeaderRow[];
  weeks: PotwWeek[];
};

const byName = (a: LeaderRow, b: LeaderRow) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);

/** Standings: most points first; tied players share a rank (1, 2, 2, 4). */
export function rankRows(rows: LeaderRow[]): (LeaderRow & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points || byName(a, b));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || sorted[i - 1].points !== r.points) rank = i + 1;
    return { ...r, rank };
  });
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The round this week belongs to: a round ends once everyone on the roster has been named in it. */
export function currentRound(rows: LeaderRow[], weeks: PotwWeek[]) {
  const round = weeks.reduce((max, w) => Math.max(max, w.round), 1);
  const named = new Set(weeks.filter((w) => w.round === round && w.player_id).map((w) => w.player_id));
  const done = rows.length > 0 && rows.every((r) => named.has(r.player_id));
  return { round: done ? round + 1 : round, named: done ? new Set<string>() : named };
}

export type RaceStatus = "eligible" | "named-this-round" | "cooldown";

/**
 * This week's race for Player of the Week, best chance first: eligible players by
 * points (her week's points so far), then those already named this round, then
 * those still waiting out six weeks. Mirrors the database's pick.
 */
export function weekRace(rows: LeaderRow[], weeks: PotwWeek[], weekStart: string) {
  const { named } = currentRound(rows, weeks);
  const status = (r: LeaderRow): { status: RaceStatus; until?: string } => {
    if (r.last_named && r.last_named > addDays(weekStart, -7 * POTW_COOLDOWN_WEEKS))
      return { status: "cooldown", until: addDays(r.last_named, 7 * POTW_COOLDOWN_WEEKS) };
    if (named.has(r.player_id)) return { status: "named-this-round" };
    return { status: "eligible" };
  };
  const order: Record<RaceStatus, number> = { eligible: 0, "named-this-round": 1, cooldown: 2 };
  return rows
    .map((r) => ({ ...r, ...status(r) }))
    .sort((a, b) => order[a.status] - order[b.status] || b.week_points - a.week_points || byName(a, b));
}

/** The latest week with a Player of the Week, if any. */
export function latestWinner(weeks: PotwWeek[]) {
  return [...weeks].sort((a, b) => b.week_start.localeCompare(a.week_start)).find((w) => w.player_id) ?? null;
}

/** "Nov 2 – 8" for the week starting on that Monday. */
export function weekRange(weekStart: string) {
  const fmt = (iso: string, withMonth: boolean) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...(withMonth ? { month: "short" } : {}), day: "numeric" }).format(new Date(`${iso}T00:00:00Z`));
  const end = addDays(weekStart, 6);
  return `${fmt(weekStart, true)} – ${fmt(end, end.slice(0, 7) !== weekStart.slice(0, 7))}`;
}

/** Checks a session before it's logged: a known kind, a date in the last week (not the future), a short note. */
export function cleanLog(input: { kind: unknown; date: unknown; note?: unknown }, today: string): { kind: SessionKind; date: string; note: string | null } | string {
  const kind = SESSION_KINDS.find((k) => k.kind === input.kind)?.kind;
  if (!kind) return "Pick what kind of session it was.";
  const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  if (!date) return "Pick the day you did it.";
  if (date > today) return "You can't log a session that hasn't happened yet.";
  if (date < addDays(today, -LOG_DAYS_BACK)) return `You can log sessions from the last ${LOG_DAYS_BACK} days.`;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, LOG_NOTE_MAX) : "";
  return { kind, date, note: note || null };
}
