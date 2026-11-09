// The practice field: a softball field with players placed at positions (more
// than one per position is fine). FieldBackdrop draws the grass and dirt;
// FieldLineup is the read-only version (plan sheet). The plan builder adds drag
// and drop on top of the same layout. Server-safe.
import type { ReactNode } from "react";
import { FIELD_H, FIELD_SHAPES, FIELD_SPOT, FIELD_W, PLAN_POSITIONS, type PlanPosition } from "@/lib/dugout";

export function FieldBackdrop() {
  const s = FIELD_SHAPES;
  return (
    <svg viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} aria-hidden className="absolute inset-0 h-full w-full">
      <path d={s.grass} fill="#06123a" />
      <path d={s.foulLines} stroke="var(--color-navy-600)" strokeWidth="1.5" />
      <path d={s.fence} fill="none" stroke="var(--color-navy-600)" strokeWidth="1.5" />
      <path d={s.infieldArc} fill="none" stroke="var(--color-navy-700)" strokeWidth="1.5" strokeDasharray="4 5" />
      <path d={s.diamond} fill="#0b1a4a" stroke="var(--color-navy-600)" strokeWidth="1.5" />
      <circle cx={s.circle.cx} cy={s.circle.cy} r={s.circle.r} fill="none" stroke="var(--color-navy-600)" strokeWidth="1.5" />
      {s.bases.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 6} y={y - 6} width="12" height="12" transform={`rotate(45 ${x} ${y})`} fill="var(--color-ink)" opacity="0.8" />
      ))}
      <path d={s.plate} fill="var(--color-ink)" opacity="0.8" />
    </svg>
  );
}

/** Where a position's zone sits, as CSS percentages of the field box. */
export function spotStyle(position: PlanPosition) {
  const [x, y] = FIELD_SPOT[position];
  return { left: `${(x / FIELD_W) * 100}%`, top: `${(y / FIELD_H) * 100}%` };
}

/** The field box: keeps the field's shape and stays in night colors in Day Game. */
export function FieldFrame({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`keep-night relative w-full overflow-hidden rounded-xl border border-navy-700 bg-navy-950 ${className}`}
      style={{ aspectRatio: `${FIELD_W} / ${FIELD_H}` }}
    >
      <FieldBackdrop />
      {children}
    </div>
  );
}

export function PositionBadge({ position, active = false }: { position: PlanPosition; active?: boolean }) {
  return (
    <span
      className={`grid h-7 w-7 place-items-center rounded-full border font-mono text-2xs font-bold ${
        active ? "border-white bg-pink text-on-accent" : "border-navy-600 bg-navy-700 text-ink"
      }`}
    >
      {position}
    </span>
  );
}

/** Read-only field with names under each position. */
export function FieldLineup({ players }: { players: Partial<Record<PlanPosition, string[]>> }) {
  return (
    <FieldFrame label="Players by position">
      {PLAN_POSITIONS.map((pos) => {
        const names = players[pos] ?? [];
        return (
          <div key={pos} className="absolute flex w-[22%] -translate-x-1/2 -translate-y-3.5 flex-col items-center gap-0.5" style={spotStyle(pos)}>
            <PositionBadge position={pos} active={names.length > 0} />
            {names.map((n, i) => (
              <span
                key={i}
                className="max-w-full truncate rounded bg-navy-950/85 px-1.5 text-2xs leading-4 font-semibold text-ink sm:text-xs"
              >
                {n}
              </span>
            ))}
          </div>
        );
      })}
    </FieldFrame>
  );
}
