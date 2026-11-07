// Manager of the Year: one for each How to Keep the Book chapter (lessons finished
// and the chapter quiz passed with 80%+). The plaque is the user's render, cut out
// of its dark studio background with the floor reflection removed
// (public/awards/manager-of-the-year.webp). Her name and the year are engraved on
// the plate's NAME and YEAR lines as SVG text over the image, so they stay sharp
// at any size. Works in server and client components.
import Image from "next/image";
import art from "../../public/awards/manager-of-the-year.webp";

// The plate's writing lines, in the image's pixels (783 x 942).
const LINES = { cx: 421, width: 262, year: 713, name: 778 };

/** Uppercase engraving that fits the line: shrink the type for long names. */
function fit(text: string, max: number) {
  const perChar = 0.7; // Jost caps plus the letter spacing, in ems
  return Math.min(max, Math.floor(LINES.width / Math.max(1, text.length * perChar)));
}

function Engraved({ y, size, children }: { y: number; size: number; children: string }) {
  const common = {
    x: LINES.cx,
    textAnchor: "middle" as const,
    fontSize: size,
    letterSpacing: 2,
    fontWeight: 600,
    style: { fontFamily: "var(--font-display)" },
  };
  return (
    <>
      {/* light catches the lower edge of the cut, the shadow sits in it */}
      <text {...common} y={y + 1.5} fill="#ffffff" opacity={0.55}>
        {children}
      </text>
      <text {...common} y={y} fill="#1c1a22" opacity={0.85}>
        {children}
      </text>
    </>
  );
}

export function ManagerAward({
  name,
  number,
  year,
  chapter,
  earned = true,
  engrave = true,
  size = 200,
  className = "",
}: {
  name: string;
  number?: string | null;
  year?: string | number | null;
  /** e.g. "Chapter 3 · The Box", for the label */
  chapter?: string;
  earned?: boolean;
  /** engrave the plate (skip for small icons where the text can't be read) */
  engrave?: boolean;
  /** width in pixels */
  size?: number;
  className?: string;
}) {
  const nameLine = [name.toUpperCase(), number ? `#${number}` : null].filter(Boolean).join("  ");
  const height = Math.round((size * art.height) / art.width);
  const what = `Manager of the Year${chapter ? `, ${chapter}` : ""}`;
  const label = earned ? `${what}, engraved ${nameLine}${year ? ` ${year}` : ""}` : `${what}, not earned yet`;
  return (
    <div
      className={`relative shrink-0 ${earned ? "" : "opacity-25 grayscale"} ${className}`}
      style={{ width: size, height }}
      role="img"
      aria-label={label}
      title={label}
    >
      <Image src={art} alt="" width={size} height={height} className="drop-shadow-[0_8px_20px_rgba(254,31,124,0.22)]" />
      {earned && engrave && (
        <svg viewBox={`0 0 ${art.width} ${art.height}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
          {year && (
            <Engraved y={LINES.year - 7} size={30}>
              {String(year)}
            </Engraved>
          )}
          <Engraved y={LINES.name - 7} size={fit(nameLine, 30)}>
            {nameLine}
          </Engraved>
        </svg>
      )}
    </div>
  );
}
