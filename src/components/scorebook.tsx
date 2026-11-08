// Scorebook pictures for the How to Keep the Book course: one at-bat box, a page of
// the book (lineup, inning columns, boxes) and the field with position numbers.
// Plain SVG with no hooks, so it works in server and client components; the field
// takes an optional onPick for the tap-the-fielders exercises.
import type { KeyboardEvent } from "react";
import { BASE, FIELDER, type Fielder } from "@/components/diamond";
import { LINEUP, POSITION_NUMBERS, type BoxMarks, type BoxPart, type FieldSpec, type SheetSpec, type Visual } from "@/lib/scorebook";

const LINE = "var(--color-navy-600)";
const LABEL = "var(--color-muted)";
const INK = "var(--color-ink)";
const PINK = "var(--color-pink)";
const NEON = "var(--color-neon)";
const DISPLAY = { fontFamily: "var(--font-display)" };

// ---------------------------------------------------------------------------
// The box (100 x 100)
// ---------------------------------------------------------------------------

const B = { home: [50, 74], first: [74, 50], second: [50, 26], third: [26, 50] } as const;
const SEGMENTS: [readonly [number, number], readonly [number, number]][] = [
  [B.home, B.first],
  [B.first, B.second],
  [B.second, B.third],
  [B.third, B.home],
];
const HIT_X = [52, 63, 74, 89];
const REACHED_Y = { BB: 79, HP: 88.5, SAC: 98 } as const;
const PART_RECT: Record<BoxPart, [number, number, number, number]> = {
  pitches: [0.5, 0.5, 24, 17],
  hits: [44, 1, 55.5, 15],
  diamond: [20, 20, 60, 60],
  reached: [0.5, 70, 22, 29.5],
  rbi: [34, 70, 32, 29.5],
  out: [76, 76, 23.5, 23.5],
  play: [28, 38, 44, 22],
};

function playSize(text: string) {
  return text.length <= 3 ? 17 : text.length <= 5 ? 14 : text.length <= 7 ? 11.5 : 9.5;
}

/**
 * Everything drawn inside one box, in a 100 x 100 space. `compact` (boxes on a
 * page of the book, drawn small) leaves out the printed labels that aren't
 * circled and draws the marks bigger so they stay readable.
 */
export function BoxDrawing({ marks, compact = false }: { marks: BoxMarks; compact?: boolean }) {
  const path = Math.min(4, Math.max(0, marks.path ?? 0));
  const fresh = new Set(marks.fresh ?? []);
  const reached = marks.reached;
  const k = compact ? 1.45 : 1;
  const lk = compact ? 1.7 : 1;
  return (
    <g>
      <rect x="0.5" y="0.5" width="99" height="99" fill="var(--color-navy-950)" stroke={LINE} strokeWidth="1" />

      {/* count: three ball squares over two strike squares */}
      {[0, 1, 2].map((i) => (
        <rect key={`b${i}`} x={2 + i * 7} y="2" width="7" height="7" fill={i < (marks.balls ?? 0) ? INK : "none"} stroke={LINE} strokeWidth="0.8" />
      ))}
      {[0, 1].map((i) => (
        <rect key={`s${i}`} x={2 + i * 7} y="9" width="7" height="7" fill={i < (marks.strikes ?? 0) ? PINK : "none"} stroke={LINE} strokeWidth="0.8" />
      ))}

      {/* hit type */}
      {["1", "2", "3", "HR"].map((t, i) => (compact && marks.hit !== i + 1) ? null : (
        <text key={t} x={HIT_X[i] - (compact ? 4 : 0)} y={compact ? 16 : 12} textAnchor="middle" fontSize={8 * lk} fill={marks.hit === i + 1 ? INK : LABEL} style={DISPLAY}>
          {t}
        </text>
      ))}
      {marks.hit && (
        <ellipse
          cx={HIT_X[marks.hit - 1] - (compact ? 4 : 0)}
          cy={compact ? 11.5 : 9.3}
          rx={(marks.hit === 4 ? 8 : 5.6) * lk}
          ry={5.6 * lk}
          fill="none"
          stroke={NEON}
          strokeWidth={1.4 * (compact ? 1.4 : 1)}
        />
      )}

      {/* BB / HP / SAC */}
      {(["BB", "HP", "SAC"] as const).map((t) => (compact && reached !== t) ? null : (
        <text key={t} x="3.5" y={compact ? 95 : REACHED_Y[t]} fontSize={7.5 * lk} fill={reached === t ? INK : LABEL} style={DISPLAY}>
          {t}
        </text>
      ))}
      {reached && (
        <ellipse
          cx={(reached === "SAC" ? 10 : 8.2) * lk}
          cy={(compact ? 95 : REACHED_Y[reached]) - 2.6 * lk}
          rx={(reached === "SAC" ? 8.6 : 6.8) * lk}
          ry={5 * lk}
          fill="none"
          stroke={NEON}
          strokeWidth={1.3 * (compact ? 1.4 : 1)}
        />
      )}

      {/* RBI triangle under home, out corner */}
      <path d="M50 74 L37 99.5 L63 99.5 Z" fill="none" stroke={LINE} strokeWidth="0.8" />
      <path d="M77 99.5 A22.5 22.5 0 0 1 99.5 77" fill="none" stroke={LINE} strokeWidth="0.8" />

      {/* scored: shade the diamond */}
      {path >= 4 && (
        <path d={`M${B.home.join(" ")} L${B.first.join(" ")} L${B.second.join(" ")} L${B.third.join(" ")} Z`} fill={NEON} fillOpacity={fresh.size ? 0.55 : 0.8} />
      )}
      {/* bases */}
      {Object.values(B).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.9" fill={LABEL} />
      ))}
      {/* her path */}
      {SEGMENTS.slice(0, path).map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={fresh.has(i + 1) ? PINK : INK} strokeWidth={2.6 * (compact ? 1.5 : 1)} strokeLinecap="round" />
      ))}
      {(marks.notes ?? []).map((n, i) => {
        const [a, b] = SEGMENTS[n.seg - 1] ?? SEGMENTS[0];
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        return (
          <text key={i} x={mx + (mx - 50) * 0.45} y={my + (my - 50) * 0.45 + 2.5} textAnchor="middle" fontSize="7" fontWeight="700" fill={PINK} style={DISPLAY}>
            {n.text}
          </text>
        );
      })}

      {/* the play */}
      {marks.play &&
        (marks.play === "Kc" ? (
          <text x="50" y={56 + (k - 1) * 8} textAnchor="middle" fontSize={18 * k} fontWeight="600" fill={INK} transform="translate(100 0) scale(-1 1)" style={DISPLAY}>
            K
          </text>
        ) : (
          <text x="50" y={55 + (k - 1) * 8} textAnchor="middle" fontSize={Math.min(playSize(marks.play) * k, compact ? 24 : 99)} fontWeight="600" fill={INK} style={DISPLAY}>
            {marks.play}
          </text>
        ))}

      {marks.rbi && (
        <text x="50" y="96.5" textAnchor="middle" fontSize={10 * (compact ? 1.4 : 1)} fontWeight="700" fill={INK} style={DISPLAY}>
          {marks.rbi}
        </text>
      )}
      {marks.out && (
        <text x="90.5" y="96.5" textAnchor="middle" fontSize={13 * (compact ? 1.35 : 1)} fontWeight="700" fill={INK} style={DISPLAY}>
          {marks.out}
        </text>
      )}
      {marks.lastOut && <line x1="84" y1="104" x2="104" y2="84" stroke={INK} strokeWidth={compact ? 4 : 2.4} strokeLinecap="round" />}

      {marks.highlight && (
        <rect
          x={PART_RECT[marks.highlight][0]}
          y={PART_RECT[marks.highlight][1]}
          width={PART_RECT[marks.highlight][2]}
          height={PART_RECT[marks.highlight][3]}
          rx="3"
          fill={PINK}
          fillOpacity="0.1"
          stroke={PINK}
          strokeWidth="1.4"
        />
      )}
    </g>
  );
}

/** Screen-reader summary of a box. */
export function describeBox(m: BoxMarks) {
  const parts: string[] = [];
  if (m.balls || m.strikes) parts.push(`count ${m.balls ?? 0}-${m.strikes ?? 0}`);
  if (m.hit) parts.push(`${["single", "double", "triple", "home run"][m.hit - 1]} circled`);
  if (m.reached) parts.push(`${m.reached} circled`);
  if (m.path) parts.push(m.path >= 4 ? "diamond shaded (scored)" : `line to ${["first", "second", "third"][m.path - 1]}`);
  if (m.play) parts.push(`play ${m.play === "Kc" ? "backwards K" : m.play}`);
  if (m.rbi) parts.push(`RBI number ${m.rbi}`);
  if (m.out) parts.push(`out ${m.out}`);
  if (m.lastOut) parts.push("last out of the inning");
  return parts.length ? `Scorebook box: ${parts.join(", ")}.` : "An empty scorebook box.";
}

export function ScoreBox({ marks, className = "" }: { marks: BoxMarks; className?: string }) {
  return (
    <figure className={`keep-night overflow-hidden rounded-xl border border-navy-700 bg-navy-950 p-3 ${className}`}>
      <svg viewBox="-2 -2 106 106" role="img" aria-label={describeBox(marks)} className="mx-auto block h-auto w-full max-w-xs">
        <BoxDrawing marks={marks} />
      </svg>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// A page of the book
// ---------------------------------------------------------------------------

const CELL = 64;
const HEAD = 22;
const COL = { spot: 20, no: 26, name: 92 };
const LINEUP_W = COL.spot + COL.no + COL.name;
const STAT_W = 26;
const STATS = ["AB", "R", "H", "RBI"];

export function ScoreSheet({ spec, className = "" }: { spec: SheetSpec; className?: string }) {
  const rows = spec.rows ?? 9;
  const names = spec.names !== false;
  const statsW = spec.stats ? STATS.length * STAT_W : 0;
  const W = LINEUP_W + spec.innings * CELL + statsW;
  const H = HEAD + rows * CELL;
  const cellX = (inning: number) => LINEUP_W + (inning - 1) * CELL;
  const rowY = (row: number) => HEAD + (row - 1) * CELL;
  const hl = spec.highlight ?? {};
  const hlRect = (x: number, y: number, w: number, h: number) => (
    <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx="4" fill={PINK} fillOpacity="0.1" stroke={PINK} strokeWidth="2.5" />
  );

  let squiggle: string | null = null;
  if (spec.squiggle) {
    const { inning, fromRow } = spec.squiggle;
    const toRow = Math.min(rows, spec.squiggle.toRow ?? rows);
    if (fromRow <= toRow) {
      const cx = cellX(inning) + CELL / 2;
      const top = rowY(fromRow) + 8;
      const bottom = rowY(toRow) + CELL - 8;
      const turns = Math.max(2, Math.round((bottom - top) / 22));
      const step = (bottom - top) / turns;
      squiggle = `M${cx} ${top}` + Array.from({ length: turns }, (_, i) => ` q${i % 2 ? -16 : 16} ${step / 2} 0 ${step}`).join("");
    }
  }

  const label = `Scorebook page: ${rows} batters, ${spec.innings} inning${spec.innings === 1 ? "" : "s"}${spec.cells && Object.keys(spec.cells).length ? ", with at-bats filled in" : ""}.`;
  return (
    <figure className={`keep-night overflow-hidden rounded-xl border border-navy-700 bg-navy-950 p-2 ${className}`}>
      <svg
        viewBox={`-2 -2 ${W + 4} ${H + 4}`}
        role="img"
        aria-label={label}
        className="mx-auto block h-auto w-full"
        style={{ maxWidth: Math.round((600 * (W + 4)) / (H + 4)) }}
      >
        <defs>
          <marker id="sheet-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10Z" fill={PINK} />
          </marker>
        </defs>

        {/* header */}
        <rect x="0" y="0" width={W} height={HEAD} fill="var(--color-navy-800)" />
        <text x={COL.spot / 2} y="15" textAnchor="middle" fontSize="9" fill={LABEL} style={DISPLAY}>#</text>
        <text x={COL.spot + COL.no / 2} y="15" textAnchor="middle" fontSize="9" fill={LABEL} style={DISPLAY}>NO</text>
        <text x={COL.spot + COL.no + 6} y="15" fontSize="9" fill={LABEL} style={DISPLAY}>PLAYER</text>
        {Array.from({ length: spec.innings }, (_, i) => (
          <text key={i} x={cellX(i + 1) + CELL / 2} y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} style={DISPLAY}>
            {i + 1}
          </text>
        ))}
        {spec.stats &&
          STATS.map((s, i) => (
            <text key={s} x={LINEUP_W + spec.innings * CELL + i * STAT_W + STAT_W / 2} y="15" textAnchor="middle" fontSize="8" fill={LABEL} style={DISPLAY}>
              {s}
            </text>
          ))}

        {/* lineup and boxes */}
        {Array.from({ length: rows }, (_, r) => {
          const row = r + 1;
          const y = rowY(row);
          const player = (spec.lineup ?? LINEUP)[r];
          return (
            <g key={row}>
              <rect x="0" y={y} width={LINEUP_W} height={CELL} fill="var(--color-navy-900)" stroke={LINE} strokeWidth="1" />
              <line x1={COL.spot} y1={y} x2={COL.spot} y2={y + CELL} stroke={LINE} strokeWidth="1" />
              <line x1={COL.spot + COL.no} y1={y} x2={COL.spot + COL.no} y2={y + CELL} stroke={LINE} strokeWidth="1" />
              <line x1={COL.spot} y1={y + CELL * 0.45} x2={LINEUP_W} y2={y + CELL * 0.45} stroke="var(--color-navy-700)" strokeWidth="0.8" />
              <text x={COL.spot / 2} y={y + 18} textAnchor="middle" fontSize="10" fill={LABEL} style={DISPLAY}>
                {row}
              </text>
              {names && player && (
                <>
                  <text x={COL.spot + COL.no / 2} y={y + 20} textAnchor="middle" fontSize="12" fontWeight="700" fill={INK} style={DISPLAY}>
                    {player.no}
                  </text>
                  <text x={COL.spot + COL.no + 6} y={y + 20} fontSize="11.5" fill={INK}>
                    {player.name}
                  </text>
                </>
              )}
              {Array.from({ length: spec.innings }, (_, i) => (
                <svg key={i} x={cellX(i + 1)} y={y} width={CELL} height={CELL} viewBox="0 0 100 100" overflow="visible">
                  <BoxDrawing marks={spec.cells?.[`${row}-${i + 1}`] ?? {}} compact />
                </svg>
              ))}
              {spec.stats &&
                STATS.map((s, i) => (
                  <rect key={s} x={LINEUP_W + spec.innings * CELL + i * STAT_W} y={y} width={STAT_W} height={CELL} fill="var(--color-navy-900)" stroke={LINE} strokeWidth="1" />
                ))}
            </g>
          );
        })}

        {squiggle && <path d={squiggle} fill="none" stroke={INK} strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" />}
        {spec.arrow && (
          <line
            x1={cellX(spec.arrow.inning) + CELL / 2}
            y1={rowY(spec.arrow.fromRow) + CELL - 6}
            x2={cellX(spec.arrow.inning) + CELL / 2}
            y2={rowY(spec.arrow.toRow) + CELL / 2}
            stroke={PINK}
            strokeWidth="3"
            markerEnd="url(#sheet-arrow)"
          />
        )}

        {/* highlights */}
        {hl.lineup && hlRect(0, HEAD, LINEUP_W, rows * CELL)}
        {hl.inning && hlRect(cellX(hl.inning), HEAD, CELL, rows * CELL)}
        {hl.row && hlRect(0, rowY(hl.row), LINEUP_W + spec.innings * CELL, CELL)}
        {hl.cell && hlRect(cellX(hl.cell[1]), rowY(hl.cell[0]), CELL, CELL)}
        {hl.stats && spec.stats && hlRect(LINEUP_W + spec.innings * CELL, 0, statsW, H)}

        {spec.tag && (
          <g>
            <rect x={cellX(spec.tag.inning) + 4} y={rowY(spec.tag.row) - 9} width={CELL - 8} height="15" rx="3" fill={PINK} />
            <text x={cellX(spec.tag.inning) + CELL / 2} y={rowY(spec.tag.row) + 2.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff" letterSpacing="0.8" style={DISPLAY}>
              {spec.tag.text}
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// The field with position numbers
// ---------------------------------------------------------------------------

const CODE = Object.fromEntries(POSITION_NUMBERS.map((p) => [p.n, p.code as Fielder])) as Record<number, Fielder>;
const at = (n: number) => FIELDER[CODE[n]];

export function PositionField({
  spec,
  onPick,
  picked = [],
  className = "",
}: {
  spec: FieldSpec;
  /** makes each fielder a button (the tap-the-fielders exercises) */
  onPick?: (n: number) => void;
  /** fielders tapped so far, in order */
  picked?: number[];
  className?: string;
}) {
  const letters = spec.labels === "letters";
  const highlight = new Set(spec.highlight ?? []);
  const [hx, hy] = BASE.home;
  let ballPath: string | null = null;
  if (spec.ball) {
    const [fx, fy] = at(spec.ball.to);
    const len = Math.hypot(fx - hx, fy - hy) || 1;
    const bx = fx - ((fx - hx) / len) * 16;
    const by = fy - ((fy - hy) / len) * 16;
    ballPath =
      spec.ball.type === "fly"
        ? `M${hx} ${hy - 6} Q${(hx + bx) / 2} ${Math.min(hy, by) - 60} ${bx} ${by}`
        : `M${hx} ${hy - 6} L${bx} ${by}`;
  }
  const name = (n: number) => POSITION_NUMBERS.find((p) => p.n === n)?.name ?? "";
  const label = letters
    ? `Field${spec.ball ? `: ball hit to the ${name(spec.ball.to).toLowerCase()}` : ""}.`
    : `Field with position numbers${spec.ball ? `: ball hit to ${spec.ball.to}, the ${name(spec.ball.to).toLowerCase()}` : ""}.`;

  return (
    <figure className={`keep-night overflow-hidden rounded-xl border border-navy-700 bg-navy-950 ${className}`}>
      <svg viewBox="0 0 400 370" role={onPick ? "group" : "img"} aria-label={label} className="block h-auto w-full">
        <defs>
          <marker id="pf-throw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10Z" fill={INK} />
          </marker>
        </defs>
        <path d="M200 335 L2 137 A280 280 0 0 1 398 137 Z" fill="#06123a" />
        <path d="M200 335 L2 137 M200 335 L398 137" stroke={LINE} strokeWidth="1.5" />
        <path d="M2 137 A280 280 0 0 1 398 137" fill="none" stroke={LINE} strokeWidth="1.5" />
        <path d="M200 335 L295 240 L200 145 L105 240 Z" fill="#0b1a4a" stroke={LINE} strokeWidth="1.5" />
        <circle cx="200" cy="238" r="18" fill="none" stroke={LINE} strokeWidth="1.5" />
        {(["first", "second", "third"] as const).map((b) => (
          <rect key={b} x={BASE[b][0] - 6} y={BASE[b][1] - 6} width="12" height="12" transform={`rotate(45 ${BASE[b][0]} ${BASE[b][1]})`} fill={INK} />
        ))}
        <path d="M193 331 h14 v5 l-7 6 l-7 -6 Z" fill={INK} />

        {ballPath && (
          <path d={ballPath} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" strokeDasharray={spec.ball?.type === "ground" ? "5 5" : undefined} />
        )}
        {(spec.throws ?? []).map(([a, b], i) => {
          const [x1, y1] = at(a);
          const [x2, y2] = at(b);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth="2.5" markerEnd="url(#pf-throw)" />;
        })}

        {POSITION_NUMBERS.map(({ n, code }) => {
          const [x, y] = at(n);
          const order = picked.indexOf(n);
          const lit = highlight.has(n) || order >= 0;
          const interactive = Boolean(onPick);
          const pick = () => onPick?.(n);
          const onKey = (e: KeyboardEvent<SVGGElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick();
            }
          };
          return (
            <g
              key={n}
              {...(interactive
                ? { role: "button", tabIndex: 0, "aria-label": `${n}, ${name(n)}`, onClick: pick, onKeyDown: onKey, className: "cursor-pointer focus:outline-none" }
                : {})}
            >
              {interactive && <circle cx={x} cy={y} r="22" fill="transparent" />}
              <circle cx={x} cy={y} r="14" fill={lit ? PINK : "var(--color-navy-700)"} stroke={lit ? "#fff" : LINE} strokeWidth="1.5" />
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize={letters ? 10 : 14} fontWeight="700" fill={lit ? "#fff" : INK} style={DISPLAY}>
                {letters ? code : n}
              </text>
              {order >= 0 && (
                <g>
                  <circle cx={x + 13} cy={y - 13} r="8" fill={NEON} />
                  <text x={x + 13} y={y - 9.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-navy-950)" style={DISPLAY}>
                    {order + 1}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Any course picture. */
export function ScoreVisual({ visual, className = "" }: { visual: Visual; className?: string }) {
  if (visual.kind === "box") return <ScoreBox marks={visual} className={className} />;
  if (visual.kind === "sheet") return <ScoreSheet spec={visual} className={className} />;
  return <PositionField spec={visual} className={className} />;
}
