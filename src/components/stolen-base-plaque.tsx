// The Stolen Base Leader plaque: one for each Baserunning IQ level passed (it
// comes with that level's ring). The art is the user's render with its
// white background made transparent, the neon edge glow kept and the acrylic frosted
// (public/awards/stolen-base-plaque.webp). Her name and number are engraved on
// the blank gold bar as SVG text over the image. Works in server and client components.
import Image from "next/image";
import art from "../../public/awards/stolen-base-plaque.webp";

// The blank gold bar, in the art's pixels (805 x 1108).
const BAR = { cx: 421, top: 702, bottom: 771, width: 306 };

function fit(text: string, max: number, width: number) {
  return Math.min(max, Math.floor(width / Math.max(1, text.length * 0.7)));
}

/** One engraved line: a light catch along the bottom of the cut, the cut itself on top. */
function Engraved({ y, size, spacing, children }: { y: number; size: number; spacing: number; children: string }) {
  const text = {
    x: BAR.cx,
    textAnchor: "middle" as const,
    fontSize: size,
    letterSpacing: spacing,
    fontWeight: 600,
    style: { fontFamily: "var(--font-display)" }, // engraving sized for Jost's letter widths
  };
  return (
    <>
      <text {...text} y={y + 1.5} fill="#fff1b8" opacity={0.5}>
        {children}
      </text>
      <text {...text} y={y} fill="#2e2104" opacity={0.85}>
        {children}
      </text>
    </>
  );
}

const LEVEL_NAME = ["", "Rookie", "Varsity", "All-American"];

export function StolenBasePlaque({
  name,
  number,
  level,
  earned = true,
  engrave = true,
  size = 220,
  className = "",
}: {
  name: string;
  number?: string | null;
  /** the Baserunning IQ level this plaque is for (engraved under the name) */
  level?: number;
  earned?: boolean;
  /** engrave the bar (skip for small icons where the text can't be read) */
  engrave?: boolean;
  /** width in pixels */
  size?: number;
  className?: string;
}) {
  const line = [name.toUpperCase(), number ? `#${number}` : null].filter(Boolean).join("  ");
  const levelLine = level ? `BASERUNNING IQ · LEVEL ${level} · ${LEVEL_NAME[level]?.toUpperCase() ?? ""}` : null;
  const height = Math.round((size * art.height) / art.width);
  const what = `Stolen Base Leader plaque${level ? `, Baserunning IQ Level ${level}` : ""}`;
  const label = earned ? `${what}, engraved ${line}` : `${what}, not earned yet`;
  const barH = BAR.bottom - BAR.top;
  // with a level: name on top, level beneath; without: the name centered on the bar
  const nameSize = fit(line, barH * (levelLine ? 0.36 : 0.42), BAR.width * 0.92);
  const nameY = levelLine ? BAR.top + barH * 0.52 : (BAR.top + BAR.bottom) / 2 + nameSize * 0.36;
  const levelSize = levelLine ? fit(levelLine, barH * 0.19, BAR.width * 0.9) : 0;
  return (
    <div
      className={`relative shrink-0 ${earned ? "" : "opacity-25 grayscale"} ${className}`}
      style={{ width: size, height }}
      role="img"
      aria-label={label}
      title={label}
    >
      <Image src={art} alt="" width={size} height={height} />
      {earned && engrave && (
        <svg viewBox={`0 0 ${art.width} ${art.height}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <Engraved y={nameY} size={nameSize} spacing={2}>
            {line}
          </Engraved>
          {levelLine && (
            <Engraved y={BAR.top + barH * 0.84} size={levelSize} spacing={1.5}>
              {levelLine}
            </Engraved>
          )}
        </svg>
      )}
    </div>
  );
}
