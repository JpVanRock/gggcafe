// Performance Training: consistency and achievements.
// Self-contained (no imports) so `npm run test:unit` can run it directly.

// "mental": guided breathing and imagery sessions (Mental GP); streaks and achievements count them,
// Leaderboard session points don't.
export const TRAINING_CATEGORIES = ["workout", "stretching", "hitting", "fielding", "pitching", "catching", "mental"] as const;
export type TrainingCategory = (typeof TRAINING_CATEGORIES)[number];

export const TRAINING_CATEGORY_LABEL: Record<TrainingCategory, { title: string; one: string }> = {
  workout: { title: "Workout routines", one: "workout" },
  stretching: { title: "Stretching routines", one: "stretching routine" },
  hitting: { title: "Hitting drills", one: "hitting drill" },
  fielding: { title: "Fielding drills", one: "fielding drill" },
  pitching: { title: "Pitching drills", one: "pitching drill" },
  catching: { title: "Catching drills", one: "catching drill" },
  mental: { title: "Mental routines", one: "mental routine" },
};

/** Pitching is for pitchers and catching for catchers; everything else is for everyone. */
export function categoriesFor(positions: string[]): TrainingCategory[] {
  return TRAINING_CATEGORIES.filter(
    (c) => (c !== "pitching" || positions.includes("P")) && (c !== "catching" || positions.includes("C")),
  );
}

export type Routine = {
  id: string;
  category: TrainingCategory;
  /** ISO weekdays 1-7; empty = once a week */
  days: number[];
  starts_on: string;
  ends_on: string | null;
};

export type Check = { activity_id: string; on_date: string };

// --- plain-date helpers (UTC math, weeks start Monday) ----------------------
function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDays(iso: string, n: number) {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoWeekday(iso: string) {
  const day = toUTC(iso).getUTCDay();
  return day === 0 ? 7 : day;
}
function weekStart(iso: string) {
  return addDays(iso, 1 - isoWeekday(iso));
}

// --- consistency -------------------------------------------------------------

export type WeekStat = {
  monday: string;
  /** routine occurrences planned for the whole week */
  scheduled: number;
  /** check-offs that week (never more than scheduled) */
  done: number;
  /** date of the last check-off that week */
  lastCheck: string | null;
};

/** How many times a routine is planned in the week starting on this Monday. */
function occurrences(r: Routine, monday: string) {
  const sunday = addDays(monday, 6);
  if (r.starts_on > sunday || (r.ends_on !== null && r.ends_on < monday)) return 0;
  if (r.days.length === 0) return 1;
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (r.days.includes(isoWeekday(d)) && d >= r.starts_on && (r.ends_on === null || d <= r.ends_on)) n++;
  }
  return n;
}

/** Planned vs done, week by week, from the first routine's start through this week. */
export function weeklyStats(routines: Routine[], checks: Check[], today: string): WeekStat[] {
  if (routines.length === 0) return [];
  const ids = new Set(routines.map((r) => r.id));
  const relevant = checks.filter((c) => ids.has(c.activity_id));
  const first = weekStart(routines.map((r) => r.starts_on).sort()[0]);
  const last = weekStart(today);
  const weeks: WeekStat[] = [];
  for (let monday = first; monday <= last; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6);
    const inWeek = relevant.filter((c) => c.on_date >= monday && c.on_date <= sunday);
    const scheduled = routines.reduce((sum, r) => sum + occurrences(r, monday), 0);
    weeks.push({
      monday,
      scheduled,
      done: Math.min(inWeek.length, scheduled),
      lastCheck: inWeek.map((c) => c.on_date).sort().at(-1) ?? null,
    });
  }
  return weeks;
}

const STREAK_RATE = 0.8;

function strongWeek(w: WeekStat) {
  return w.scheduled > 0 && w.done / w.scheduled >= STREAK_RATE;
}

/**
 * Consecutive weeks at 80%+ of the plan. Weeks with nothing planned don't
 * break a streak. This week only counts once it has already reached 80%.
 */
export function streaks(weeks: WeekStat[], today: string) {
  const thisMonday = weekStart(today);
  let run = 0;
  let best = 0;
  const reachedAt = new Map<number, string>(); // streak length -> date it was first reached
  for (const w of weeks) {
    if (w.scheduled === 0) continue;
    if (strongWeek(w)) {
      run++;
      if (run > best) {
        best = run;
        if (!reachedAt.has(run)) reachedAt.set(run, w.lastCheck ?? w.monday);
      }
    } else if (w.monday !== thisMonday) {
      run = 0;
    }
  }
  return { current: run, best, reachedAt };
}

// --- achievements ------------------------------------------------------------

export type AchievementDef = {
  key: string;
  title: string;
  description: string;
  /** only for players who play this position */
  position?: "P" | "C";
  rule:
    | { kind: "total"; count: number; category?: TrainingCategory }
    | { kind: "perfect_week" }
    | { kind: "streak"; weeks: number };
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_rep", title: "First Rep", description: "Check off a training routine for the first time.", rule: { kind: "total", count: 1 } },
  { key: "double_digits", title: "Double Digits", description: "10 training check-offs.", rule: { kind: "total", count: 10 } },
  { key: "perfect_week", title: "Perfect Week", description: "Every planned routine done in one week.", rule: { kind: "perfect_week" } },
  { key: "hot_streak", title: "Hot Streak", description: "3 weeks in a row at 80% or better.", rule: { kind: "streak", weeks: 3 } },
  { key: "grinder", title: "Grinder", description: "50 training check-offs.", rule: { kind: "total", count: 50 } },
  { key: "iron_will", title: "Iron Will", description: "8 weeks in a row at 80% or better.", rule: { kind: "streak", weeks: 8 } },
  { key: "century_club", title: "Century Club", description: "100 training check-offs.", rule: { kind: "total", count: 100 } },
  { key: "workhorse", title: "Workhorse", description: "20 workouts done.", rule: { kind: "total", count: 20, category: "workout" } },
  { key: "loose_and_ready", title: "Loose & Ready", description: "20 stretching routines done.", rule: { kind: "total", count: 20, category: "stretching" } },
  { key: "barrel_buster", title: "Barrel Buster", description: "25 hitting drills done.", rule: { kind: "total", count: 25, category: "hitting" } },
  // key kept as "golden_glove" so achievements already earned stay attached; the title changed
  // because "Golden Glove" is now the position-test award
  { key: "golden_glove", title: "Prep Step", description: "25 fielding drills done.", rule: { kind: "total", count: 25, category: "fielding" } },
  { key: "ace", title: "Ace", description: "25 pitching drills done.", position: "P", rule: { kind: "total", count: 25, category: "pitching" } },
  { key: "brick_wall", title: "Brick Wall", description: "25 catching drills done.", position: "C", rule: { kind: "total", count: 25, category: "catching" } },
  { key: "locked_in", title: "Locked In", description: "20 mental routines done.", rule: { kind: "total", count: 20, category: "mental" } },
];

export type AchievementProgress = {
  def: AchievementDef;
  current: number;
  target: number;
  /** date it was first earned, or null while locked */
  unlockedOn: string | null;
};

/** Where the player stands on every achievement they can earn. */
export function evaluateAchievements(input: {
  routines: Routine[];
  checks: Check[];
  today: string;
  positions: string[];
}): AchievementProgress[] {
  const { routines, today, positions } = input;
  const byId = new Map(routines.map((r) => [r.id, r]));
  const checks = input.checks
    .filter((c) => byId.has(c.activity_id) && c.on_date <= today)
    .sort((a, b) => a.on_date.localeCompare(b.on_date));
  const weeks = weeklyStats(routines, checks, today);
  const streak = streaks(weeks, today);

  return ACHIEVEMENTS.filter((def) => !def.position || positions.includes(def.position)).map((def) => {
    const rule = def.rule;
    if (rule.kind === "total") {
      const list = rule.category ? checks.filter((c) => byId.get(c.activity_id)?.category === rule.category) : checks;
      return {
        def,
        current: Math.min(list.length, rule.count),
        target: rule.count,
        unlockedOn: list.length >= rule.count ? list[rule.count - 1].on_date : null,
      };
    }
    if (rule.kind === "perfect_week") {
      const perfect = weeks.find((w) => w.scheduled > 0 && w.done >= w.scheduled);
      return { def, current: perfect ? 1 : 0, target: 1, unlockedOn: perfect ? (perfect.lastCheck ?? perfect.monday) : null };
    }
    return {
      def,
      current: Math.min(Math.max(streak.best, streak.current), rule.weeks),
      target: rule.weeks,
      unlockedOn: streak.reachedAt.get(rule.weeks) ?? null,
    };
  });
}
