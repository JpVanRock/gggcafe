// Offseason training (SB Blueprint Phase 2, user 2026-11-08): the season roadmap
// (training phases, planned backward from the championship), the athletic testing
// pack (ten tests with starter rating bands for girls by age group, a 1-5 rating
// and a composite score) and the offseason draft (snake order, squad standings).
// Starter bands are a starting point for coaches to edit (Dugout → Training →
// Testing), not official norms. No imports, so it runs in unit tests.

// ---------------------------------------------------------------------------
// Dates (plain ISO dates, UTC math, weeks start Monday)
// ---------------------------------------------------------------------------
function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDays(iso: string, n: number) {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}
function monday(iso: string) {
  const day = toUTC(iso).getUTCDay();
  return addDays(iso, 1 - (day === 0 ? 7 : day));
}

// ---------------------------------------------------------------------------
// The roadmap: phases
// ---------------------------------------------------------------------------

export const PHASE_KINDS = ["testing", "build", "sport", "preseason", "inseason", "recovery"] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];

export const PHASE_INFO: Record<PhaseKind, { label: string; focus: string }> = {
  testing: { label: "Testing week", focus: "Run the testing pack so everyone knows where she starts and how far she's come." },
  build: { label: "Build", focus: "General strength, speed and conditioning. Learn the movements and build the base." },
  sport: { label: "Sport-specific", focus: "Turn the base into softball: first-step speed, rotational power, throwing and swinging volume." },
  preseason: { label: "Preseason", focus: "Game-speed reps and team work; training volume comes down, quality goes up." },
  inseason: { label: "In-season", focus: "Maintain strength and speed with short, regular sessions; recover between games." },
  recovery: { label: "Recovery", focus: "Rest and active recovery: mobility, light movement, fun." },
};

export type Phase = { id?: string; kind: PhaseKind; name: string; starts_on: string; ends_on: string; focus?: string | null };

/**
 * A roadmap planned backward from the championship: in-season from the first game,
 * a 3-week preseason before it, a retest week before that, 6 weeks sport-specific,
 * and a testing week then build from the start. Phases that don't fit are dropped
 * or shortened; boundaries after the first phase fall on Mondays.
 */
export function suggestRoadmap(input: { start: string; firstGame: string; championship: string }): Phase[] {
  const { start, firstGame, championship } = input;
  if (!(start < firstGame && firstGame <= championship)) return [];
  const preseason = monday(addDays(firstGame, -21)) > start ? monday(addDays(firstGame, -21)) : start;
  const retest = monday(addDays(preseason, -7));
  const sport = monday(addDays(retest, -42));
  const test = start;
  const buildStart = addDays(test, 7);
  const out: Phase[] = [];
  const push = (kind: PhaseKind, from: string, to: string, name?: string) => {
    if (from <= to) out.push({ kind, name: name ?? PHASE_INFO[kind].label, starts_on: from, ends_on: to, focus: PHASE_INFO[kind].focus });
  };
  if (daysBetween(buildStart, retest) >= 21) {
    // room for the full plan: testing, build (if any weeks left), sport-specific (3+ weeks), retest
    push("testing", test, addDays(test, 6));
    const sportFrom = sport > buildStart ? sport : buildStart;
    if (sportFrom > buildStart) push("build", buildStart, addDays(sportFrom, -1));
    push("sport", sportFrom, addDays(retest, -1));
    push("testing", retest, addDays(preseason, -1), "Retest week");
  } else if (daysBetween(start, preseason) >= 14) {
    // a short runway: a testing week, then one block straight into the preseason
    push("testing", test, addDays(test, 6));
    push("sport", buildStart, addDays(preseason, -1));
  } else if (preseason > start) {
    push("sport", start, addDays(preseason, -1));
  }
  push("preseason", preseason, addDays(firstGame, -1));
  push("inseason", firstGame, championship);
  return out;
}

/** The phase covering a date (the latest-starting one if phases overlap). */
export function phaseOn<T extends { starts_on: string; ends_on: string }>(phases: T[], date: string): T | null {
  return [...phases].filter((p) => p.starts_on <= date && date <= p.ends_on).sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0] ?? null;
}

/** "Week 3 of 6" for a date inside a phase. */
export function phaseWeek(phase: { starts_on: string; ends_on: string }, date: string): { week: number; of: number } {
  const of = Math.max(1, Math.ceil((daysBetween(phase.starts_on, phase.ends_on) + 1) / 7));
  const week = Math.min(of, Math.max(1, Math.floor(daysBetween(phase.starts_on, date) / 7) + 1));
  return { week, of };
}

/** Phases that overlap each other (shown as a warning; the latest-starting one wins). */
export function overlaps(phases: { starts_on: string; ends_on: string; name: string }[]): [string, string][] {
  const sorted = [...phases].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const out: [string, string][] = [];
  for (let i = 1; i < sorted.length; i++) if (sorted[i].starts_on <= sorted[i - 1].ends_on) out.push([sorted[i - 1].name, sorted[i].name]);
  return out;
}

// ---------------------------------------------------------------------------
// The athletic testing pack
// ---------------------------------------------------------------------------

export const AGE_TIERS = ["youth", "u12", "u14", "u16", "u18"] as const;
export type AgeTier = (typeof AGE_TIERS)[number];

/** Age group to band tier: 8U-10U, 11U-12U, 13U-14U, 15U-16U, 17U-18U (no age group: 13U-14U). */
export function tierFor(ageGroup: string | null | undefined): AgeTier {
  const n = Number(/^(\d{1,2})U$/.exec(ageGroup ?? "")?.[1]);
  if (!n) return "u14";
  return n <= 10 ? "youth" : n <= 12 ? "u12" : n <= 14 ? "u14" : n <= 16 ? "u16" : "u18";
}

export type TestDef = {
  /** metrics.key: results are measurements */
  key: string;
  name: string;
  unit: string;
  better: "higher" | "lower";
  /** how to run it, in a line */
  how: string;
  /** starter cutoffs between ratings 1-2, 2-3, 3-4 and 4-5, per tier */
  bands: Record<AgeTier, [number, number, number, number]>;
};

export const TESTS: TestDef[] = [
  {
    key: "pro_agility", name: "Pro agility (5-10-5)", unit: "sec", better: "lower",
    how: "Start on the middle line: 5 yards one way, 10 back, 5 through the start. Best of 2.",
    bands: { youth: [7.0, 6.6, 6.2, 5.8], u12: [6.5, 6.1, 5.8, 5.5], u14: [6.0, 5.7, 5.4, 5.1], u16: [5.8, 5.5, 5.2, 4.95], u18: [5.7, 5.4, 5.1, 4.85] },
  },
  {
    key: "sprint_20yd", name: "20-yard sprint", unit: "sec", better: "lower",
    how: "From a standing start. Best of 2.",
    bands: { youth: [4.4, 4.1, 3.9, 3.7], u12: [4.1, 3.9, 3.7, 3.5], u14: [3.9, 3.7, 3.5, 3.35], u16: [3.8, 3.6, 3.4, 3.25], u18: [3.7, 3.5, 3.35, 3.2] },
  },
  {
    key: "home_to_first", name: "Home to first", unit: "sec", better: "lower",
    how: "From her finish in the box, through the bag on contact. Best of 2.",
    bands: { youth: [4.2, 3.9, 3.7, 3.5], u12: [3.9, 3.7, 3.5, 3.3], u14: [3.7, 3.5, 3.3, 3.1], u16: [3.6, 3.4, 3.2, 3.0], u18: [3.5, 3.3, 3.1, 2.95] },
  },
  {
    key: "broad_jump", name: "Broad jump", unit: "in", better: "higher",
    how: "Two feet to two feet, and stick the landing. Best of 3.",
    bands: { youth: [48, 54, 60, 66], u12: [54, 60, 66, 72], u14: [60, 66, 72, 78], u16: [64, 70, 76, 82], u18: [66, 72, 78, 84] },
  },
  {
    key: "vertical_jump", name: "Vertical jump", unit: "in", better: "higher",
    how: "Standing reach, then the highest touch from a two-foot jump. Best of 3.",
    bands: { youth: [8, 10, 12, 14], u12: [10, 12, 14, 16], u14: [11, 13, 15, 18], u16: [12, 14, 17, 20], u18: [13, 15, 18, 21] },
  },
  {
    key: "med_ball_throw", name: "Rotational med-ball throw", unit: "ft", better: "higher",
    how: "Side-on, like a swing. 4 lb for 12U and under, 6 lb for 13U and up. Best of 3.",
    bands: { youth: [15, 20, 25, 30], u12: [20, 25, 30, 35], u14: [22, 27, 32, 38], u16: [25, 30, 36, 42], u18: [27, 33, 39, 45] },
  },
  {
    key: "push_ups", name: "Push-ups (1 minute)", unit: "reps", better: "higher",
    how: "Chest to a fist-height target, full lockout, as many as she can in 60 seconds.",
    bands: { youth: [5, 10, 15, 20], u12: [8, 13, 18, 24], u14: [10, 15, 22, 28], u16: [12, 18, 25, 32], u18: [12, 18, 25, 32] },
  },
  {
    key: "plank", name: "Plank hold", unit: "sec", better: "higher",
    how: "Forearm plank in a straight line from head to heels; time stops when the hips drop.",
    bands: { youth: [30, 45, 60, 90], u12: [40, 60, 80, 110], u14: [45, 70, 95, 120], u16: [60, 80, 110, 140], u18: [60, 90, 120, 150] },
  },
  {
    key: "single_leg_hop", name: "Single-leg hop (weaker leg)", unit: "in", better: "higher",
    how: "Hop forward and stick on the same leg. Test both legs; record the weaker one.",
    bands: { youth: [36, 42, 48, 54], u12: [42, 48, 54, 60], u14: [46, 52, 58, 64], u16: [50, 56, 62, 68], u18: [52, 58, 64, 70] },
  },
  {
    key: "shuttle_300", name: "300-yard shuttle", unit: "sec", better: "lower",
    how: "25 yards and back, six times (12 legs), all out.",
    bands: { youth: [90, 84, 78, 72], u12: [84, 78, 73, 68], u14: [80, 75, 70, 65], u16: [77, 72, 67, 63], u18: [75, 70, 66, 62] },
  },
];

export const RATING_LABELS = ["Building", "Developing", "Solid", "Strong", "Elite"] as const;

export function testByKey(key: string): TestDef | undefined {
  return TESTS.find((t) => t.key === key);
}

/** The cutoffs for a test and age group: a coach's override, else the starter band. */
export function cutoffsFor(test: TestDef, ageGroup: string | null | undefined, overrides: { metric_key: string; age_group: string; cutoffs: number[] }[] = []) {
  const own = overrides.find((o) => o.metric_key === test.key && o.age_group === ageGroup);
  return (own?.cutoffs.map(Number) as [number, number, number, number] | undefined) ?? test.bands[tierFor(ageGroup)];
}

/** 1-5: one more for every cutoff the value reaches (at or past it, in the better direction). */
export function rate(value: number, better: "higher" | "lower", cutoffs: number[]): number {
  return 1 + cutoffs.filter((c) => (better === "higher" ? value >= c : value <= c)).length;
}

/** Cutoffs must run in the better direction: ascending when higher is better, descending when lower is. */
export function validCutoffs(better: "higher" | "lower", cutoffs: number[]): boolean {
  if (cutoffs.length !== 4 || cutoffs.some((c) => !Number.isFinite(c) || c <= 0)) return false;
  return cutoffs.every((c, i) => i === 0 || (better === "higher" ? c > cutoffs[i - 1] : c < cutoffs[i - 1]));
}

/** 0-100 from the ratings she has (null with none). */
export function composite(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length / 5) * 100);
}

// ---------------------------------------------------------------------------
// The offseason draft
// ---------------------------------------------------------------------------

export const SQUAD_MIN = 2;
export const SQUAD_MAX = 8;

/** Snake draft: which squad (0-based, in pick order) is on the clock after `picks` picks. */
export function onTheClock(squads: number, picks: number): number {
  if (squads <= 0) return 0;
  const round = Math.floor(picks / squads);
  const i = picks % squads;
  return round % 2 === 0 ? i : squads - 1 - i;
}

export type SquadRow = { id: string; name: string; captain_id: string; pick_order: number; members: string[] };

/** Squads with their points from the Leaderboard, best first. */
export function squadStandings(squads: SquadRow[], players: { player_id: string; points: number; week_points: number }[]) {
  const byId = new Map(players.map((p) => [p.player_id, p]));
  return squads
    .map((s) => {
      const members = s.members.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
      return {
        ...s,
        points: members.reduce((t, p) => t + p.points, 0),
        weekPoints: members.reduce((t, p) => t + p.week_points, 0),
      };
    })
    .sort((a, b) => b.points - a.points || b.weekPoints - a.weekPoints || a.pick_order - b.pick_order);
}
