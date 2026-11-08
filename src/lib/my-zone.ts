// My Zone (SB Blueprint Phase 3, user 2026-11-08): on her Preferred Hitting Style she
// marks her pitch, the zones she handles and her weak zones on the 1-9 strike-zone
// grid (catcher's view: 1-3 up, 4-6 middle, 7-9 down; same as pitch zones). Her
// count plan comes from it: 0 strikes = her pitch, 1 strike = what she handles,
// 2 strikes = protect the whole zone and battle on her weak spots.
// No imports, so it runs in unit tests and client components.

export const ZONE_CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type ZoneState = "hot" | "strong" | "weak" | "none";
export type HittingZones = { hot: number[]; strong: number[]; weak: number[]; notes?: string | null };

export const ZONE_LABEL: Record<Exclude<ZoneState, "none">, { name: string; note: string }> = {
  hot: { name: "My pitch", note: "Where she does damage: sit on it early in the count" },
  strong: { name: "I handle it", note: "She can square it up when she has to" },
  weak: { name: "Work on it", note: "Lay off early; battle and shorten up with two strikes" },
};

export const ZONE_NOTES_MAX = 300;

/** Where a cell is (catcher's view). */
export function cellName(cell: number): string {
  const row = cell <= 3 ? "Up" : cell <= 6 ? "Middle" : "Down";
  const col = (cell - 1) % 3;
  return `${row}, ${col === 0 ? "left" : col === 1 ? "center" : "right"} (catcher's view)`;
}

export function stateOf(zones: HittingZones | null, cell: number): ZoneState {
  if (!zones) return "none";
  return zones.hot.includes(cell) ? "hot" : zones.strong.includes(cell) ? "strong" : zones.weak.includes(cell) ? "weak" : "none";
}

/** Tapping a cell cycles it: none → I handle it → my pitch → work on it → none. */
export function cycle(zones: HittingZones, cell: number): HittingZones {
  const next: Record<ZoneState, ZoneState> = { none: "strong", strong: "hot", hot: "weak", weak: "none" };
  return setState(zones, cell, next[stateOf(zones, cell)]);
}

export function setState(zones: HittingZones, cell: number, state: ZoneState): HittingZones {
  const without = (list: number[]) => list.filter((c) => c !== cell);
  const out = { ...zones, hot: without(zones.hot), strong: without(zones.strong), weak: without(zones.weak) };
  if (state !== "none") out[state] = [...out[state], cell].sort((a, b) => a - b);
  return out;
}

/** Valid cells only, each in one list. */
export function cleanZones(input: { hot?: unknown; strong?: unknown; weak?: unknown }): HittingZones {
  const used = new Set<number>();
  const pick = (v: unknown) =>
    (Array.isArray(v) ? v : [])
      .map(Number)
      .filter((c) => Number.isInteger(c) && c >= 1 && c <= 9 && !used.has(c) && (used.add(c), true))
      .sort((a, b) => a - b);
  const hot = pick(input.hot);
  const strong = pick(input.strong);
  const weak = pick(input.weak);
  return { hot, strong, weak };
}

export type CountStep = { strikes: 0 | 1 | 2; title: string; swing: number[]; battle: number[]; cue: string };

/** Her count plan: which cells to swing at with 0, 1 and 2 strikes. */
export function countPlan(zones: HittingZones | null): CountStep[] {
  const hot = zones?.hot ?? [];
  const strong = zones?.strong ?? [];
  const weak = zones?.weak ?? [];
  const early = hot.length ? hot : strong;
  const all = [...ZONE_CELLS];
  return [
    {
      strikes: 0,
      title: "0 strikes: hunt",
      swing: [...early].sort((a, b) => a - b),
      battle: [],
      cue: hot.length ? "Sit on your pitch. If it isn't there, let it go." : "Mark your pitch to sharpen this plan; until then, look for what you handle.",
    },
    {
      strikes: 1,
      title: "1 strike: handle it",
      swing: [...new Set([...hot, ...strong])].sort((a, b) => a - b),
      battle: [],
      cue: "Swing at anything you handle. Still let your weak spots go.",
    },
    {
      strikes: 2,
      title: "2 strikes: protect",
      swing: all.filter((c) => !weak.includes(c)),
      battle: [...weak],
      cue: "Protect the whole zone. On your weak spots, shorten up and fight it off.",
    },
  ];
}
