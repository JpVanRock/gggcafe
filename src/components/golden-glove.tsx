// The Golden Glove award for passing a position IQ test (80%+). The trophy is the
// user's render (public/awards/golden-glove.webp, cut out of its white background);
// the player's name and number are engraved on the gold plate as SVG text laid
// over the image, so they stay sharp at any size. Works in server and client components.
import Image from "next/image";
import gloveImage from "../../public/awards/golden-glove.webp";

// The gold plate, in the trophy image's pixels (860 x 801).
const PLATE = { cx: 420, top: 670, bottom: 776, textWidth: 520 };

/** Uppercase engraving that fits the plate: shrink the type for long names. */
function fit(text: string, max: number, width: number) {
  const perChar = 0.72; // Jost caps plus the letter spacing, in ems
  return Math.min(max, Math.floor(width / Math.max(1, text.length * perChar)));
}

function Engraved({ y, size, spacing, children }: { y: number; size: number; spacing: number; children: string }) {
  const common = {
    x: PLATE.cx,
    textAnchor: "middle" as const,
    fontSize: size,
    letterSpacing: spacing,
    fontWeight: 600,
    style: { fontFamily: "var(--font-sans)" },
  };
  return (
    <>
      {/* light catches the lower edge of the cut, the shadow sits in it */}
      <text {...common} y={y + 1.6} fill="#fff1b8" opacity={0.55}>
        {children}
      </text>
      <text {...common} y={y} fill="#3a2a05" opacity={0.85}>
        {children}
      </text>
    </>
  );
}

export function GoldenGlove({
  name,
  number,
  position,
  year,
  earned = true,
  engrave = true,
  size = 240,
  className = "",
}: {
  name: string;
  number?: string | null;
  /** e.g. "Shortstop" */
  position: string;
  year?: string | number | null;
  earned?: boolean;
  /** engrave the plate (skip for small icons where the text can't be read) */
  engrave?: boolean;
  /** width in pixels */
  size?: number;
  className?: string;
}) {
  const line1 = [name.toUpperCase(), number ? `#${number}` : null].filter(Boolean).join("  ");
  const line2 = [position.toUpperCase(), "GOLDEN GLOVE", year].filter(Boolean).join(" · ");
  const height = Math.round((size * gloveImage.height) / gloveImage.width);
  const label = earned ? `${position} Golden Glove, engraved ${line1}` : `${position} Golden Glove, not earned yet`;
  return (
    <div
      className={`relative shrink-0 ${earned ? "" : "opacity-25 grayscale"} ${className}`}
      style={{ width: size, height }}
      role="img"
      aria-label={label}
      title={label}
    >
      <Image src={gloveImage} alt="" width={size} height={height} className="drop-shadow-[0_8px_20px_rgba(231,251,6,0.14)]" />
      {earned && engrave && (
        <svg viewBox={`0 0 ${gloveImage.width} ${gloveImage.height}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <Engraved y={PLATE.top + 50} size={fit(line1, 40, PLATE.textWidth)} spacing={3}>
            {line1}
          </Engraved>
          <Engraved y={PLATE.bottom - 24} size={fit(line2, 19, PLATE.textWidth)} spacing={4}>
            {line2}
          </Engraved>
        </svg>
      )}
    </div>
  );
}
