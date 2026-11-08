// GameDay reference values and lineup checks. No imports, so it runs in
// server and client code and in unit tests (npm run test:unit). Codes match the
// checks in the movement_hitting_gameday migration.

export const HITTING_TYPES = ["power", "contact", "gap"] as const;
export type HittingType = (typeof HITTING_TYPES)[number];
export const HITTING_TYPE_LABEL: Record<HittingType, string> = { power: "Power hitter", contact: "Contact hitter", gap: "Gap hitter" };

export const BASE_RUNNING = ["pure", "intelligent", "average"] as const;
export type BaseRunning = (typeof BASE_RUNNING)[number];
export const BASE_RUNNING_LABEL: Record<BaseRunning, string> = { pure: "Pure speed", intelligent: "Intelligent speed", average: "Average speed" };

/** What a player can do in a defensive rotation: a field position, pitch, or sit. */
export const ROTATION_SPOTS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "Sub"] as const;
export type RotationSpot = (typeof ROTATION_SPOTS)[number];
const FIELD = ROTATION_SPOTS.filter((s) => s !== "Sub");

export const PITCHES = ["Fastball", "Changeup", "Dropball", "Drop Curve", "Curveball", "Rise Ball", "Screwball"] as const;
export type Pitch = (typeof PITCHES)[number];

export const MAX_ROTATIONS = 7;

/** One defensive rotation: player id -> spot. */
export type Rotation = Record<string, RotationSpot>;
/** Pitching plan for one rotation. */
export type PitchPlan = { primary: Pitch | null; secondary: Pitch | null; chase: Pitch[] };

/** Field spots nobody has, and spots given to more than one player (Sub can repeat). */
export function rotationProblems(rotation: Rotation | undefined) {
  const counts = new Map<string, number>();
  for (const spot of Object.values(rotation ?? {})) if (spot !== "Sub") counts.set(spot, (counts.get(spot) ?? 0) + 1);
  return {
    missing: FIELD.filter((s) => !counts.has(s)),
    doubled: FIELD.filter((s) => (counts.get(s) ?? 0) > 1),
  };
}

/** Who pitches in a rotation (the first player set to P), or null. */
export function pitcherOf(rotation: Rotation | undefined) {
  return Object.entries(rotation ?? {}).find(([, spot]) => spot === "P")?.[0] ?? null;
}

/** ".412" style for AVG/OBP (no leading zero), "18.5%" for K%; "–" when unknown. */
export function rate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "–";
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return n >= 1 ? n.toFixed(3) : n.toFixed(3).replace(/^0/, "");
}
export function percent(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "–";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "–";
}

// ---------------------------------------------------------------------------
// DP/FLEX, game-day jobs and in-game substitutions (SB Blueprint Phase 9)
// ---------------------------------------------------------------------------

/** The DP bats (she's in the order); the FLEX plays defense only and is the extra line on the card. */
export function dpFlexProblems(order: string[], dp: string | null, flex: string | null): string[] {
  const problems: string[] = [];
  if (dp && !order.includes(dp)) problems.push("The DP has to be in the batting order.");
  if (flex && order.includes(flex)) problems.push("The FLEX doesn't bat: take her out of the batting order.");
  if (dp && flex && dp === flex) problems.push("The DP and the FLEX are two different players.");
  if (flex && !dp) problems.push("Pick the DP the FLEX plays defense for.");
  return problems;
}

/** Who plays the field: the batting order, with the FLEX in for the DP when they're set. */
export function fieldingPlayers(order: string[], dp: string | null, flex: string | null): string[] {
  if (!dp || !flex) return order;
  return [...order.filter((id) => id !== dp), flex];
}

export type GameJob = { job: string; who: string };
export const GAME_JOB_STARTERS = ["Third-base coach", "First-base coach", "Keep the book", "Pitch chart", "Warm-ups", "Video"];

/** One substitution: in this inning, `in` takes over lineup spot `spot` (the FLEX line is the last spot). */
export type SubEntry = { inning: number; spot: number; in: string };

export type SubCheck = { entry: SubEntry; out: string | null; reentry: boolean; problem: string | null };

/**
 * Track substitutions with the fastpitch re-entry rule: any starter may leave and come
 * back once, in her own spot; a substitute who leaves is done for the game; nobody holds
 * two spots. Returns who is in each spot now, each entry with any problem, and the
 * starters who are out and can still re-enter.
 */
export function trackSubs(starters: string[], log: SubEntry[]) {
  const current = new Map<number, string>(starters.map((id, i) => [i + 1, id]));
  const startSpot = new Map(starters.map((id, i) => [id, i + 1]));
  const reentered = new Set<string>();
  const left = new Set<string>();
  const checks: SubCheck[] = [];
  for (const entry of log) {
    const out = current.get(entry.spot) ?? null;
    const holding = [...current].find(([spot, id]) => id === entry.in && spot !== entry.spot);
    const starterSpot = startSpot.get(entry.in);
    const isReentry = starterSpot !== undefined && left.has(entry.in);
    let problem: string | null = null;
    if (!current.has(entry.spot)) problem = "There's no such spot in the lineup.";
    else if (out === entry.in) problem = "She's already in that spot.";
    else if (holding) problem = `She's already in the lineup (spot ${holding[0]}).`;
    else if (starterSpot !== undefined && isReentry && starterSpot !== entry.spot) problem = "A starter re-enters only in her own spot.";
    else if (starterSpot !== undefined && reentered.has(entry.in)) problem = "She already used her re-entry.";
    else if (starterSpot === undefined && left.has(entry.in)) problem = "A substitute who left can't come back.";
    checks.push({ entry, out, reentry: isReentry && !problem, problem });
    if (problem) continue;
    if (isReentry) reentered.add(entry.in);
    if (out) left.add(out);
    left.delete(entry.in);
    current.set(entry.spot, entry.in);
  }
  const canReenter = starters.filter((id) => left.has(id) && !reentered.has(id) && ![...current.values()].includes(id));
  return { current: Object.fromEntries(current) as Record<number, string>, checks, canReenter };
}
