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
