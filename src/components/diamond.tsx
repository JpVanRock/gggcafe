// Softball diamond diagram for IQ questions: runners, outs, where the ball is hit,
// and who "you" are. Shows the situation only, never the answer. Works in server
// and client components (plain SVG, no hooks).

export type Base = "home" | "first" | "second" | "third";
export type Fielder = "P" | "C" | "1B" | "2B" | "SS" | "3B" | "LF" | "CF" | "RF";
export type BallType = "ground" | "line" | "fly" | "popup" | "bunt" | "blooper";

export type DiamondSpec = {
  runners?: Base[];
  outs?: number;
  /** a fielder code, "batter", or "runner-first" / "runner-second" / "runner-third" */
  you?: string;
  ball?: { at: string; type?: BallType };
  arrows?: { from: string; to: string; kind?: "run" | "steal" | "throw" }[];
};

// Field geometry (viewBox 0 0 400 370). Bases are 60 ft apart; the pitching
// plate is 43 ft from home, on the line to second base.
export const BASE: Record<Base, [number, number]> = {
  home: [200, 335],
  first: [295, 240],
  second: [200, 145],
  third: [105, 240],
};
export const FIELDER: Record<Fielder, [number, number]> = {
  P: [200, 238],
  C: [200, 358],
  "1B": [282, 212],
  "2B": [244, 170],
  SS: [156, 170],
  "3B": [118, 212],
  LF: [92, 108],
  CF: [200, 74],
  RF: [308, 108],
};
const SPOT: Record<string, [number, number]> = {
  "LF-line": [42, 150],
  "LCF-gap": [143, 82],
  "RCF-gap": [257, 82],
  "RF-line": [358, 150],
  "deep-LF": [82, 64],
  "deep-CF": [200, 44],
  "deep-RF": [318, 64],
  "bunt-3B": [163, 298],
  "bunt-1B": [237, 298],
  "bunt-P": [200, 292],
  "bunt-C": [200, 316],
  "blooper-LF": [128, 138],
  "blooper-CF": [200, 116],
  "blooper-RF": [272, 138],
  "popup-C": [222, 360],
  "popup-IF": [200, 196],
};

function point(name: string): [number, number] | null {
  if (name in BASE) return BASE[name as Base];
  if (name in FIELDER) return FIELDER[name as Fielder];
  if (name in SPOT) return SPOT[name];
  return null;
}

/** Where the ball ends up: a named spot, or just in front of the fielder it was hit to. */
function ballPoint(at: string): [number, number] | null {
  if (at in SPOT) return SPOT[at];
  if (at in FIELDER) {
    const [x, y] = FIELDER[at as Fielder];
    const [hx, hy] = BASE.home;
    const len = Math.hypot(x - hx, y - hy) || 1;
    return [x - ((x - hx) / len) * 16, y - ((y - hy) / len) * 16]; // a step in front of the fielder
  }
  return null;
}

const BASE_LABEL: Record<Base, string> = { home: "home", first: "first", second: "second", third: "third" };
const TYPE_LABEL: Record<BallType, string> = {
  ground: "ground ball",
  line: "line drive",
  fly: "fly ball",
  popup: "pop-up",
  bunt: "bunt",
  blooper: "blooper",
};

const FIELDER_NAME: Record<Fielder, string> = {
  P: "the pitcher", C: "the catcher", "1B": "the first baseman", "2B": "the second baseman", SS: "the shortstop",
  "3B": "the third baseman", LF: "the left fielder", CF: "the center fielder", RF: "the right fielder",
};

const SPOT_NAME: Record<string, string> = {
  "LF-line": "down the left-field line", "LCF-gap": "the left-center gap", "RCF-gap": "the right-center gap",
  "RF-line": "down the right-field line", "deep-LF": "deep left field", "deep-CF": "deep center field",
  "deep-RF": "deep right field", "bunt-3B": "down the third-base line", "bunt-1B": "down the first-base line",
  "bunt-P": "back to the pitcher", "bunt-C": "in front of the plate", "blooper-LF": "shallow left field",
  "blooper-CF": "shallow center field", "blooper-RF": "shallow right field", "popup-C": "behind the plate",
  "popup-IF": "the infield",
};

/** Screen-reader description of the diagram, e.g. "Runner on first, 1 out, ground ball to the second baseman. You're the shortstop." */
export function describeDiamond(spec: DiamondSpec) {
  const list = spec.runners ?? [];
  const runners = list.length
    ? `${list.length === 1 ? "Runner" : "Runners"} on ${list.map((b) => BASE_LABEL[b]).join(", ").replace(/, ([^,]*)$/, " and $1")}`
    : "Bases empty";
  const outs = `${spec.outs ?? 0} out${spec.outs === 1 ? "" : "s"}`;
  const at = spec.ball?.at ?? "";
  const where = at in FIELDER_NAME ? `to ${FIELDER_NAME[at as Fielder]}` : SPOT_NAME[at]?.startsWith("down") || SPOT_NAME[at]?.startsWith("back") || SPOT_NAME[at]?.startsWith("in front") || SPOT_NAME[at]?.startsWith("behind") ? SPOT_NAME[at] : `to ${SPOT_NAME[at] ?? at}`;
  const ball = spec.ball ? `, ${TYPE_LABEL[spec.ball.type ?? "ground"]} ${where}` : "";
  const you = !spec.you
    ? ""
    : spec.you === "batter"
      ? ". You're the batter"
      : spec.you.startsWith("runner-")
        ? `. You're the runner on ${spec.you.slice(7)}`
        : spec.you in FIELDER_NAME
          ? `. You're ${FIELDER_NAME[spec.you as Fielder]}`
          : "";
  return `${runners}, ${outs}${ball}${you}.`;
}

export function Diamond({ spec, className = "" }: { spec: DiamondSpec; className?: string }) {
  const runners = new Set(spec.runners ?? []);
  const youRunner = spec.you?.startsWith("runner-") ? (spec.you.slice(7) as Base) : null;
  const youBatter = spec.you === "batter";
  const youFielder = spec.you && spec.you in FIELDER ? (spec.you as Fielder) : null;
  const ballEnd = spec.ball ? ballPoint(spec.ball.at) : null;
  const ballType = spec.ball?.type ?? "ground";
  const [hx, hy] = BASE.home;

  let ballPath: string | null = null;
  if (ballEnd) {
    const [bx, by] = ballEnd;
    if (ballType === "fly" || ballType === "popup" || ballType === "blooper") {
      // arc: control point lifted above the midpoint
      const cx = (hx + bx) / 2 + (bx - hx) * 0.08;
      const cy = Math.min(hy, by) - (ballType === "popup" ? 70 : 55);
      ballPath = `M${hx} ${hy - 6} Q${cx} ${cy} ${bx} ${by}`;
    } else {
      ballPath = `M${hx} ${hy - 6} L${bx} ${by}`;
    }
  }

  return (
    <figure className={`keep-night overflow-hidden rounded-xl border border-navy-700 bg-navy-950 ${className}`}>
      <svg viewBox="0 0 400 370" role="img" aria-label={describeDiamond(spec)} className="block h-auto w-full">
        <defs>
          <marker id="dmd-arrow-run" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10Z" fill="var(--color-neon)" />
          </marker>
          <marker id="dmd-arrow-throw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10Z" fill="var(--color-ink)" />
          </marker>
        </defs>

        {/* field */}
        <path d="M200 335 L2 137 A280 280 0 0 1 398 137 Z" fill="#06123a" />
        <path d="M200 335 L2 137 M200 335 L398 137" stroke="var(--color-navy-600)" strokeWidth="1.5" />
        <path d="M2 137 A280 280 0 0 1 398 137" fill="none" stroke="var(--color-navy-600)" strokeWidth="1.5" />
        <path d="M80 215 A170 170 0 0 1 320 215" fill="none" stroke="var(--color-navy-700)" strokeWidth="1.5" strokeDasharray="4 5" />
        <path d="M200 335 L295 240 L200 145 L105 240 Z" fill="#0b1a4a" stroke="var(--color-navy-600)" strokeWidth="1.5" />
        <circle cx="200" cy="238" r="18" fill="none" stroke="var(--color-navy-600)" strokeWidth="1.5" />
        <rect x="194" y="236" width="12" height="3" fill="var(--color-muted)" />

        {/* bases */}
        {(["first", "second", "third"] as Base[]).map((b) => (
          <rect key={b} x={BASE[b][0] - 6} y={BASE[b][1] - 6} width="12" height="12" transform={`rotate(45 ${BASE[b][0]} ${BASE[b][1]})`} fill="var(--color-ink)" />
        ))}
        <path d="M193 331 h14 v5 l-7 6 l-7 -6 Z" fill="var(--color-ink)" />

        {/* fielders */}
        {(Object.keys(FIELDER) as Fielder[]).map((f) => {
          const [x, y] = FIELDER[f];
          const you = f === youFielder;
          return (
            <g key={f}>
              <circle cx={x} cy={y} r="11" fill={you ? "var(--color-pink)" : "var(--color-navy-700)"} stroke={you ? "#fff" : "var(--color-navy-600)"} strokeWidth="1.5" />
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={you ? "#fff" : "var(--color-ink)"} fontFamily="var(--font-mono)">
                {f}
              </text>
            </g>
          );
        })}

        {/* ball flight */}
        {ballPath && (
          <path
            d={ballPath}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.85"
            strokeWidth="2"
            strokeDasharray={ballType === "ground" || ballType === "bunt" ? "5 5" : undefined}
          />
        )}
        {ballEnd && (
          <g>
            <circle cx={ballEnd[0]} cy={ballEnd[1]} r="6" fill="#fff" stroke="var(--color-pink)" strokeWidth="2" />
          </g>
        )}

        {/* context arrows (runners going, a throw already made) */}
        {(spec.arrows ?? []).map((a, i) => {
          const from = point(a.from);
          const to = point(a.to);
          if (!from || !to) return null;
          const throwArrow = a.kind === "throw";
          return (
            <line
              key={i}
              x1={from[0]}
              y1={from[1]}
              x2={to[0]}
              y2={to[1]}
              stroke={throwArrow ? "var(--color-ink)" : "var(--color-neon)"}
              strokeWidth="2.5"
              strokeDasharray={throwArrow ? undefined : "6 4"}
              markerEnd={`url(#dmd-arrow-${throwArrow ? "throw" : "run"})`}
            />
          );
        })}

        {/* runners */}
        {(["first", "second", "third"] as Base[]).map((b) => {
          if (!runners.has(b)) return null;
          const [x, y] = BASE[b];
          const you = b === youRunner;
          const dx = b === "first" ? 14 : b === "third" ? -14 : 0;
          const dy = b === "second" ? -14 : -6;
          return (
            <g key={b}>
              <circle cx={x + dx} cy={y + dy} r="9" fill="var(--color-neon)" stroke={you ? "var(--color-pink)" : "var(--color-navy-950)"} strokeWidth={you ? 4 : 2} />
              <text x={x + dx} y={y + dy + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-navy-950)" fontFamily="var(--font-mono)">
                R
              </text>
            </g>
          );
        })}
        {youBatter && <circle cx={hx + 18} cy={hy - 4} r="9" fill="var(--color-neon)" stroke="var(--color-pink)" strokeWidth="4" />}

        {/* "YOU" tag */}
        {(() => {
          let at: [number, number] | null = null;
          if (youFielder) at = FIELDER[youFielder];
          else if (youRunner) {
            const [x, y] = BASE[youRunner];
            at = [x + (youRunner === "first" ? 14 : youRunner === "third" ? -14 : 0), y + (youRunner === "second" ? -14 : -6)];
          } else if (youBatter) at = [hx + 18, hy - 4];
          if (!at) return null;
          const [x, y] = at;
          return (
            <g>
              <rect x={x - 17} y={y - 33} width="34" height="15" rx="3" fill="var(--color-pink)" />
              <text x={x} y={y - 22.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="var(--font-mono)" letterSpacing="1">
                YOU
              </text>
            </g>
          );
        })()}

        {/* outs */}
        <g>
          <text x="14" y="26" fontSize="11" fontWeight="700" fill="var(--color-muted)" fontFamily="var(--font-mono)" letterSpacing="1.5">
            OUTS
          </text>
          {[0, 1].map((i) => (
            <circle key={i} cx={66 + i * 16} cy={22} r="5.5" fill={(spec.outs ?? 0) > i ? "var(--color-pink)" : "none"} stroke="var(--color-pink)" strokeWidth="1.5" />
          ))}
        </g>
      </svg>
    </figure>
  );
}
