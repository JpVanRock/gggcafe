// The move dial: both feet seen from above (toes up), split into four spots:
// left toes, right toes, left heel, right heel. 1 is where she's strongest and
// most balanced; 4 is her least natural spot. Plain SVG, server-safe, uses the
// theme tokens so it works in Night Game and Day Game.
import type { DialRank, Spot } from "@/lib/movement";

const SPOT_AT: Record<Spot, [number, number]> = {
  left_front: [75, 102],
  right_front: [185, 102],
  left_heel: [68, 238],
  right_heel: [192, 238],
};
const SPOT_NAME: Record<Spot, string> = {
  left_front: "left toes",
  right_front: "right toes",
  left_heel: "left heel",
  right_heel: "right heel",
};

// A left shoe sole, toes up, big toe on the inside (right edge). Mirrored for the right foot.
const SOLE =
  "M46 2 C66 2 76 24 74 56 C72 92 62 112 58 134 C55 152 58 178 56 202 C54 224 44 236 32 236 C20 236 12 224 12 204 C12 182 16 160 14 138 C10 112 0 88 2 56 C4 22 24 2 46 2 Z";

function Marker({ rank, x, y }: { rank: DialRank; x: number; y: number }) {
  if (rank === "1") {
    return (
      <g>
        <circle cx={x} cy={y} r={30} className="fill-pink" opacity={0.18} />
        <circle cx={x} cy={y} r={23} className="fill-neon stroke-pink" strokeWidth={3} />
        <text x={x} y={y + 8} textAnchor="middle" fontSize={24} fontWeight={800} className="fill-on-accent" style={{ fontFamily: "var(--font-display)" }}>
          1
        </text>
      </g>
    );
  }
  const unsure = rank === "2/3";
  const weakest = rank === "4";
  return (
    <g opacity={weakest ? 0.55 : 1}>
      <circle
        cx={x}
        cy={y}
        r={19}
        className={weakest ? "fill-none stroke-navy-600" : unsure ? "fill-navy-800 stroke-navy-600" : "fill-navy-700 stroke-pink"}
        strokeWidth={2}
        strokeDasharray={unsure ? "4 3" : undefined}
      />
      <text
        x={x}
        y={y + (unsure ? 5 : 7)}
        textAnchor="middle"
        fontSize={unsure ? 13 : 19}
        fontWeight={700}
        className={weakest || unsure ? "fill-muted" : "fill-ink"}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {rank}
      </text>
    </g>
  );
}

export function MoveDial({ dial, size = 220, className = "" }: { dial: Record<Spot, DialRank> | null; size?: number; className?: string }) {
  const label = dial
    ? `Move dial: ${(Object.entries(dial) as [Spot, DialRank][])
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([s, r]) => `${r} ${SPOT_NAME[s]}`)
        .join(", ")}`
    : "Move dial: not set yet";
  return (
    <svg viewBox="0 0 260 300" width={size} height={(size * 300) / 260} role="img" aria-label={label} className={`shrink-0 ${className}`}>
      <title>{label}</title>
      <rect x={4} y={4} width={252} height={292} rx={18} className="fill-navy-900 stroke-navy-700" strokeWidth={2} />
      {/* front/back and left/right lines */}
      <line x1={130} y1={34} x2={130} y2={276} className="stroke-navy-600" strokeWidth={1.5} />
      <line x1={16} y1={170} x2={244} y2={170} className="stroke-navy-600" strokeWidth={1.5} />
      <path d="M130 18 l7 12 h-14 Z" className="fill-pink" />
      <text x={146} y={28} fontSize={10} fontWeight={700} letterSpacing={1.5} className="fill-muted" style={{ fontFamily: "var(--font-mono)" }}>
        TOES
      </text>
      <text x={146} y={288} fontSize={10} fontWeight={700} letterSpacing={1.5} className="fill-muted" style={{ fontFamily: "var(--font-mono)" }}>
        HEELS
      </text>
      <text x={22} y={288} fontSize={10} fontWeight={700} letterSpacing={1.5} className="fill-muted" style={{ fontFamily: "var(--font-mono)" }}>
        LEFT
      </text>
      <text x={238} y={28} textAnchor="end" fontSize={10} fontWeight={700} letterSpacing={1.5} className="fill-muted" style={{ fontFamily: "var(--font-mono)" }}>
        RIGHT
      </text>
      {/* feet */}
      <path d={SOLE} transform="translate(34 46)" className="fill-navy-800 stroke-navy-600" strokeWidth={2} />
      <path d={SOLE} transform="translate(226 46) scale(-1 1)" className="fill-navy-800 stroke-navy-600" strokeWidth={2} />
      {dial ? (
        (Object.keys(SPOT_AT) as Spot[]).map((s) => <Marker key={s} rank={dial[s]} x={SPOT_AT[s][0]} y={SPOT_AT[s][1]} />)
      ) : (
        <text x={130} y={175} textAnchor="middle" fontSize={13} className="fill-muted">
          Not set yet
        </text>
      )}
    </svg>
  );
}
