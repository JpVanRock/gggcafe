// Culture & team (SB Blueprint Phase 5, user 2026-11-08): Team Season Goals, the
// season motto, her commitment (one "I will..." covering every Team Standard, user
// 2026-11-11) and the team pledge, and Player Spotlights. No imports, so it runs in
// unit tests and client code.

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
  /** when the coach added it: goals are numbered 1, 2, 3… in the order they were entered */
  created_at?: string | null;
};

/** 0-100 toward a numeric target (100 once achieved), or null without a target. */
export function goalProgress(goal: Pick<TeamGoal, "target" | "current" | "achieved_at">): number | null {
  if (goal.achieved_at) return 100;
  if (goal.target === null || goal.target === 0) return null;
  return Math.max(0, Math.min(100, Math.round(((goal.current ?? 0) / goal.target) * 100)));
}

/** Goals in the order the coach entered them (user, 2026-11-11), so they number 1 to the last. */
export function sortGoals<T extends Pick<TeamGoal, "position" | "created_at">>(goals: T[]): T[] {
  return [...goals].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.position - b.position);
}

export const MOTTO_MAX = 80;
export const SPOTLIGHT = { headline: 80, body: 1200 } as const;

/**
 * Her commitment: one "I will..." that covers every Team Standard (user, 2026-11-11), saved
 * in `team_pledges.lines` under this key.
 */
export const PLEDGE_KEY = "all";
export const PLEDGE_MAX = 500;

/** The lines to save from what she typed: her one commitment, trimmed and capped. */
export function cleanPledge(text: unknown): Record<string, string> {
  const v = typeof text === "string" ? text.replace(/\s+\n/g, "\n").trim().slice(0, PLEDGE_MAX) : "";
  return v ? { [PLEDGE_KEY]: v } : {};
}

/** Her commitment as one text (a pledge from before had a line per standard: those are joined). */
export function pledgeLine(lines: Record<string, string> | null | undefined): string {
  if (!lines) return "";
  return (lines[PLEDGE_KEY] ?? Object.values(lines).filter((v) => v?.trim()).join(" ")).trim();
}

/** A pledge counts as complete once she has written her commitment and signed. */
export function pledgeStatus(pledge: { lines: Record<string, string>; signed_at: string | null } | null) {
  const written = Boolean(pledgeLine(pledge?.lines));
  const signed = Boolean(pledge?.signed_at);
  return { written, signed, complete: written && signed };
}
