// Culture & team (SB Blueprint Phase 5, user 2026-11-08): Team Season Goals, the
// season motto, her commitment ("I will..." per Team Standard) and the team pledge,
// and Player Spotlights. No imports, so it runs in unit tests and client code.

export const GOAL_PHASES = ["preseason", "early", "mid", "late", "postseason", "season"] as const;
export type GoalPhase = (typeof GOAL_PHASES)[number];
export const GOAL_PHASE_LABEL: Record<GoalPhase, string> = {
  preseason: "Preseason",
  early: "Early season",
  mid: "Midseason",
  late: "Late season",
  postseason: "Postseason",
  season: "All season",
};

export type TeamGoal = {
  id: string;
  phase: GoalPhase;
  title: string;
  target: number | null;
  current: number | null;
  unit: string | null;
  achieved_at: string | null;
  position: number;
};

/** 0-100 toward a numeric target (100 once achieved), or null without a target. */
export function goalProgress(goal: Pick<TeamGoal, "target" | "current" | "achieved_at">): number | null {
  if (goal.achieved_at) return 100;
  if (goal.target === null || goal.target === 0) return null;
  return Math.max(0, Math.min(100, Math.round(((goal.current ?? 0) / goal.target) * 100)));
}

/** Goals in season order, then by position. */
export function sortGoals<T extends Pick<TeamGoal, "phase" | "position">>(goals: T[]): T[] {
  return [...goals].sort((a, b) => GOAL_PHASES.indexOf(a.phase) - GOAL_PHASES.indexOf(b.phase) || a.position - b.position);
}

export const MOTTO_MAX = 80;
export const LINE_MAX = 200;
export const SPOTLIGHT = { headline: 80, body: 1200 } as const;

/** Her "I will..." lines kept only for the team's current standards, trimmed and capped. */
export function cleanLines(lines: Record<string, unknown>, standardTitles: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const title of standardTitles) {
    const v = lines[title];
    if (typeof v === "string" && v.trim()) out[title] = v.trim().slice(0, LINE_MAX);
  }
  return out;
}

/** A pledge counts as complete once every standard has a line and she has signed. */
export function pledgeStatus(pledge: { lines: Record<string, string>; signed_at: string | null } | null, standardTitles: string[]) {
  const written = standardTitles.filter((t) => pledge?.lines[t]?.trim()).length;
  return { written, total: standardTitles.length, signed: Boolean(pledge?.signed_at), complete: Boolean(pledge?.signed_at) && written === standardTitles.length };
}
