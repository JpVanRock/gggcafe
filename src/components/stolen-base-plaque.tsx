// The Stolen Base Leader plaque: earned by passing all three Baserunning IQ
// levels (it comes with the Level 3 ring). The art is the user's render with its
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

export function StolenBasePlaque({
  name,
  number,
  earned = true,
  engrave = true,
  size = 220,
  className = "",
}: {
  name: string;
  number?: string | null;
  earned?: boolean;
  /** engrave the bar (skip for small icons where the text can't be read) */
  engrave?: boolean;
  /** width in pixels */
  size?: number;
  className?: string;
}) {
  const line = [name.toUpperCase(), number ? `#${number}` : null].filter(Boolean).join("  ");
  const height = Math.round((size * art.height) / art.width);
  const label = earned ? `Stolen Base Leader plaque, engraved ${line}` : "Stolen Base Leader plaque, not earned yet";
  const fontSize = fit(line, (BAR.bottom - BAR.top) * 0.42, BAR.width * 0.92);
  const y = (BAR.top + BAR.bottom) / 2 + fontSize * 0.36;
  const text = {
    x: BAR.cx,
    textAnchor: "middle" as const,
    fontSize,
    letterSpacing: 2,
    fontWeight: 600,
    style: { fontFamily: "var(--font-sans)" },
  };
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
          <text {...text} y={y + 1.5} fill="#fff1b8" opacity={0.5}>
            {line}
          </text>
          <text {...text} y={y} fill="#2e2104" opacity={0.85}>
            {line}
          </text>
        </svg>
      )}
    </div>
  );
}
