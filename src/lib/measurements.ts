// Measurements on her POP Report (user, 2026-11-10): four seasons a year (Fall Season,
// Winter Offseason, Spring Season, Summer Season, set by the date it was measured), a
// default list for every player, fastball speed for pitchers and pop time for catchers,
// and whatever else her team's coaches add in Dugout → Training → Measurements. Values are
// rows in public.measurements (Testing results land there too). No imports, so it runs in
// unit tests and client code.

export type SeasonKey = "fall" | "winter" | "spring" | "summer";

/** The softball year runs September to August: Fall first. */
export const SEASONS: { key: SeasonKey; name: string; months: number[] }[] = [
  { key: "fall", name: "Fall Season", months: [9, 10, 11] },
  { key: "winter", name: "Winter Offseason", months: [12, 1, 2] },
  { key: "spring", name: "Spring Season", months: [3, 4, 5] },
  { key: "summer", name: "Summer Season", months: [6, 7, 8] },
];

const month = (date: string) => Number(date.slice(5, 7));

/** The season a measurement counts for, from its date (YYYY-MM-DD). */
export function seasonOf(date: string): SeasonKey {
  const m = month(date);
  return SEASONS.find((s) => s.months.includes(m))!.key;
}

/** The softball year a date falls in, by the year it starts: 2026-10-01 and 2027-03-01 are both 2026 (2026–27). */
export function softballYear(date: string): number {
  const y = Number(date.slice(0, 4));
  return month(date) >= 9 ? y : y - 1;
}

export const yearLabel = (year: number) => `${year}–${String((year + 1) % 100).padStart(2, "0")}`;

/** The season's name with its calendar year(s): "Fall Season 2026", "Winter Offseason 2026–27". */
export function seasonLabel(season: SeasonKey, year: number) {
  const name = SEASONS.find((s) => s.key === season)!.name;
  return season === "fall" ? `${name} ${year}` : season === "winter" ? `${name} ${yearLabel(year)}` : `${name} ${year + 1}`;
}

export type MeasureDef = { key: string; name: string; unit: string; better: "higher" | "lower" };

/** Every player's list, in this order (metrics.key; names as coaches say them). */
export const DEFAULT_MEASUREMENTS: MeasureDef[] = [
  { key: "home_to_first", name: "Time to first", unit: "sec", better: "lower" },
  { key: "first_to_second", name: "First to second", unit: "sec", better: "lower" },
  { key: "first_to_home", name: "First to home", unit: "sec", better: "lower" },
  { key: "throw_velo_overhand", name: "Overhand throwing speed", unit: "mph", better: "higher" },
  { key: "rotational_acceleration", name: "Rotational acceleration", unit: "g", better: "higher" },
  { key: "connection_score", name: "Connection score", unit: "score", better: "higher" },
  { key: "on_plane_score", name: "On-plane score", unit: "score", better: "higher" },
];
export const PITCHER_MEASUREMENT: MeasureDef = { key: "pitch_velo_fastball", name: "Fastball speed", unit: "mph", better: "higher" };
export const CATCHER_MEASUREMENT: MeasureDef = { key: "pop_time", name: "Pop time", unit: "sec", better: "lower" };

/** Keys every team always has (coaches can't remove them; pitchers and catchers get theirs). */
export const BUILT_IN_KEYS = [...DEFAULT_MEASUREMENTS, PITCHER_MEASUREMENT, CATCHER_MEASUREMENT].map((m) => m.key);
export const TEAM_EXTRA_MAX = 20;

/**
 * Her list: the defaults, fastball speed if she pitches, pop time if she catches, her
 * team's extras, then anything else she has a measurement for. `all` names the extras.
 */
export function measurementsFor(
  positions: (string | null | undefined)[],
  teamExtras: string[],
  measured: string[],
  all: MeasureDef[],
): MeasureDef[] {
  const list: MeasureDef[] = [...DEFAULT_MEASUREMENTS];
  if (positions.includes("P")) list.push(PITCHER_MEASUREMENT);
  if (positions.includes("C")) list.push(CATCHER_MEASUREMENT);
  for (const key of [...teamExtras, ...measured]) {
    if (list.some((m) => m.key === key)) continue;
    const def = all.find((m) => m.key === key) ?? (key === PITCHER_MEASUREMENT.key ? PITCHER_MEASUREMENT : key === CATCHER_MEASUREMENT.key ? CATCHER_MEASUREMENT : null);
    if (def) list.push(def);
  }
  return list;
}

export type MeasurementRow = { id: string; metric_key: string; value: number; measured_on: string; created_at?: string };

/** One year's grid: the latest value in each season, per measurement. */
export function seasonGrid(rows: MeasurementRow[], year: number) {
  const grid = new Map<string, Partial<Record<SeasonKey, MeasurementRow>>>();
  const sorted = [...rows].sort((a, b) => a.measured_on.localeCompare(b.measured_on) || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  for (const r of sorted) {
    if (softballYear(r.measured_on) !== year) continue;
    const cells = grid.get(r.metric_key) ?? {};
    cells[seasonOf(r.measured_on)] = r; // later rows win
    grid.set(r.metric_key, cells);
  }
  return grid;
}

/** Her best ever, whichever direction is better. */
export function bestOf(rows: MeasurementRow[], def: MeasureDef): MeasurementRow | null {
  const mine = rows.filter((r) => r.metric_key === def.key);
  if (!mine.length) return null;
  return mine.reduce((best, r) => ((def.better === "higher" ? r.value > best.value : r.value < best.value) ? r : best));
}

/** The years she has measurements in, newest first, always including `current`. */
export function yearsWithData(rows: MeasurementRow[], current: number): number[] {
  return [...new Set([current, ...rows.map((r) => softballYear(r.measured_on))])].sort((a, b) => b - a);
}

/** A value as coaches write it: up to two decimals, no trailing zeros, with its unit. */
export function formatMeasure(value: number, unit: string) {
  const n = Number(value.toFixed(2));
  return unit === "score" ? String(n) : `${n} ${unit}`;
}
