// Box-score entry, quality at-bats and BP production (GameDay → Box scores, Training → BP).
// No imports: shared by server and client code and unit-tested with node --test.
// Innings pitched are stored as outs (4.2 IP = 14 outs); checks mirror the database's.

export type BattingLine = {
  player_id: string;
  pa: number; ab: number; r: number; h: number; d: number; t: number; hr: number; rbi: number;
  bb: number; so: number; hbp: number; sac: number; sf: number; sb: number; cs: number;
};
export type PitchingLine = {
  player_id: string;
  outs: number; bf: number; h: number; r: number; er: number; bb: number; so: number; hbp: number; hr: number; wp: number;
  pitches: number | null; strikes: number | null; decision: "W" | "L" | "S" | null; starter: boolean;
};
export type FieldingLine = { player_id: string; po: number; a: number; e: number; dp: number; pb: number; sba: number; cs: number };
export type PaGrade = { player_id: string; pa_no: number; grade: number };
export type BoxScore = { us: number | null; them: number | null; batting: BattingLine[]; pitching: PitchingLine[]; fielding: FieldingLine[]; grades: PaGrade[] };

export const BATTING_COLUMNS = ["pa", "ab", "r", "h", "d", "t", "hr", "rbi", "bb", "so", "hbp", "sac", "sf", "sb", "cs"] as const;
export const BATTING_LABEL: Record<(typeof BATTING_COLUMNS)[number], string> = {
  pa: "PA", ab: "AB", r: "R", h: "H", d: "2B", t: "3B", hr: "HR", rbi: "RBI", bb: "BB", so: "SO", hbp: "HBP", sac: "SAC", sf: "SF", sb: "SB", cs: "CS",
};
export const PITCHING_COLUMNS = ["bf", "h", "r", "er", "bb", "so", "hbp", "hr", "wp"] as const;
export const PITCHING_LABEL: Record<(typeof PITCHING_COLUMNS)[number], string> = {
  bf: "BF", h: "H", r: "R", er: "ER", bb: "BB", so: "SO", hbp: "HBP", hr: "HR", wp: "WP",
};
export const FIELDING_COLUMNS = ["po", "a", "e", "dp", "pb", "sba", "cs"] as const;
export const FIELDING_LABEL: Record<(typeof FIELDING_COLUMNS)[number], string> = { po: "PO", a: "A", e: "E", dp: "DP", pb: "PB", sba: "SBA", cs: "CS" };

/** "4.2" -> 14 outs; "5" -> 15; null for anything else (the decimal is outs, 0-2). */
export function parseIp(raw: string): number | null {
  const m = /^\s*(\d{1,2})(?:\.([0-2]))?\s*$/.exec(raw);
  if (!m) return null;
  return Number(m[1]) * 3 + Number(m[2] ?? 0);
}

/** 14 outs -> "4.2" */
export function ipLabel(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

export const emptyBatting = (player_id: string): BattingLine => ({
  player_id, pa: 0, ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, so: 0, hbp: 0, sac: 0, sf: 0, sb: 0, cs: 0,
});
export const emptyFielding = (player_id: string): FieldingLine => ({ player_id, po: 0, a: 0, e: 0, dp: 0, pb: 0, sba: 0, cs: 0 });

export const battingIsEmpty = (b: BattingLine) => BATTING_COLUMNS.every((k) => b[k] === 0);
export const fieldingIsEmpty = (f: FieldingLine) => FIELDING_COLUMNS.every((k) => f[k] === 0);

/** Problems that would stop the box score saving, each naming the player. */
export function boxProblems(box: BoxScore, name: (id: string) => string): string[] {
  const out: string[] = [];
  for (const b of box.batting) {
    const who = name(b.player_id);
    if (b.h > b.ab) out.push(`${who}: more hits than at-bats.`);
    if (b.d + b.t + b.hr > b.h) out.push(`${who}: extra-base hits are more than her hits.`);
    if (b.so > b.ab) out.push(`${who}: more strikeouts than at-bats.`);
    if (b.pa < b.ab + b.bb + b.hbp + b.sac + b.sf) out.push(`${who}: PA must be at least AB + BB + HBP + SAC + SF.`);
  }
  for (const p of box.pitching) {
    const who = name(p.player_id);
    if (p.er > p.r) out.push(`${who}: more earned runs than runs.`);
    if (p.hr > p.h) out.push(`${who}: more home runs than hits allowed.`);
    if (p.pitches !== null && p.strikes !== null && p.strikes > p.pitches) out.push(`${who}: more strikes than pitches.`);
  }
  if (box.pitching.filter((p) => p.decision === "W").length > 1) out.push("Only one pitcher gets the win.");
  if (box.pitching.filter((p) => p.decision === "L").length > 1) out.push("Only one pitcher gets the loss.");
  const pa = new Map(box.batting.map((b) => [b.player_id, b.pa]));
  for (const g of box.grades) {
    if (g.grade < 0 || g.grade > 5) out.push(`${name(g.player_id)}: grades are 0 to 5.`);
    if (g.pa_no > (pa.get(g.player_id) ?? 0)) out.push(`${name(g.player_id)}: a grade for a plate appearance she didn't have.`);
  }
  return [...new Set(out)];
}

// ---------------------------------------------------------------------------
// Quality at-bats (0-5 per plate appearance) and BP production (0-5 per swing)
// ---------------------------------------------------------------------------

/** The grading scale (fastpitch: an executed slap or bunt is a top grade). */
export const QAB_SCALE: { grade: number; label: string }[] = [
  { grade: 5, label: "Hard-hit ball, or the slap, bunt or squeeze executed" },
  { grade: 4, label: "Hard-hit out, or a long battle (7+ pitches)" },
  { grade: 3, label: "Walk, HBP, moved a runner, or a sac fly" },
  { grade: 2, label: "Competed: fouled off tough pitches, weak contact" },
  { grade: 1, label: "Weak out early in the count" },
  { grade: 0, label: "Strikeout looking or no competitive swing" },
];

/** A quality at-bat is graded 3 or better. */
export const QUALITY = 3;

export function qabSummary(grades: number[]) {
  const n = grades.length;
  const quality = grades.filter((g) => g >= QUALITY).length;
  return {
    graded: n,
    quality,
    qabPct: n ? Math.round((1000 * quality) / n) / 10 : null,
    production: n ? Math.round((100 * grades.reduce((a, g) => a + g, 0)) / n) / 100 : null,
  };
}

/** Grades from a BP keypad string like "5 4 3 0" or "5430". */
export function parseSwings(raw: string): number[] | null {
  const digits = raw.replace(/[\s,]/g, "");
  if (!/^[0-5]{1,100}$/.test(digits)) return null;
  return [...digits].map(Number);
}
