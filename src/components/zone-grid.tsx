// My Zone on the 1-9 strike-zone grid (catcher's view). Works in server and client
// components. `onCell` makes the cells buttons (the editor).
import { ZONE_CELLS, cellName, stateOf, type HittingZones, type ZoneState } from "@/lib/my-zone";

const FILL: Record<ZoneState, string> = {
  hot: "bg-neon text-on-accent",
  strong: "bg-pink/25 text-ink border-pink",
  weak: "bg-navy-950 text-muted [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(254_31_124/0.25)_6px_8px)]",
  none: "bg-navy-800/60 text-muted",
};
const MARK: Record<ZoneState, string> = { hot: "My pitch", strong: "Handle", weak: "Work", none: "" };

export function ZoneGrid({
  zones,
  size = 150,
  only,
  battle = [],
  labels = true,
  onCell,
}: {
  zones: HittingZones | null;
  size?: number;
  /** highlight just these cells (a count-plan step); others dim */
  only?: number[];
  /** cells to battle on (two strikes): outlined */
  battle?: number[];
  labels?: boolean;
  onCell?: (cell: number) => void;
}) {
  return (
    <div role="group" aria-label="Strike zone, catcher's view" className="grid grid-cols-3 gap-1 rounded-lg border-2 border-ink/70 p-1" style={{ width: size, height: size }}>
      {ZONE_CELLS.map((cell) => {
        const state = only ? (only.includes(cell) ? (stateOf(zones, cell) === "none" ? "strong" : stateOf(zones, cell)) : "none") : stateOf(zones, cell);
        const fight = battle.includes(cell);
        const cls = `grid place-items-center rounded border border-transparent text-center font-mono text-2xs leading-tight font-bold tracking-wider uppercase transition ${FILL[fight ? "weak" : state]} ${
          fight ? "border-dashed !border-pink" : ""
        }`;
        const label = `${cellName(cell)}: ${fight ? "battle" : MARK[state] || "not marked"}`;
        return onCell ? (
          <button key={cell} type="button" onClick={() => onCell(cell)} aria-label={label} title={label} className={`${cls} hover:ring-2 hover:ring-pink/60`}>
            {labels && MARK[state]}
          </button>
        ) : (
          <span key={cell} role="img" aria-label={label} title={label} className={cls}>
            {labels && (fight ? "Battle" : MARK[state])}
          </span>
        );
      })}
    </div>
  );
}
