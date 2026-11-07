// MVP badge: earned for a test once every question she missed has been answered
// again in its review (or with a perfect score). Hexagon like the training
// achievements, scaled up: neon edge, pink inner line and speed stripes, the test
// it was earned on along the bottom. Plain SVG, no gradients or ids, so any
// number can sit on one page (including inside closed pop-ups).

/** Font size (one decimal) that fits `text` in `width`: monospace is ~0.6em per character, plus letter spacing. */
function fit(text: string, max: number, width: number) {
  return Math.min(max, Math.floor((10 * width) / (Math.max(1, text.length) * 0.68)) / 10);
}

export function MvpBadge({
  label,
  earned = true,
  size = 72,
  className = "",
}: {
  /** the test it was earned on, e.g. "Defense IQ · L1" */
  label: string;
  earned?: boolean;
  /** width in pixels */
  size?: number;
  className?: string;
}) {
  const caption = label.toUpperCase();
  const title = `MVP badge · ${label}${earned ? "" : " · not earned yet"}`;
  return (
    <svg
      viewBox="0 0 120 132"
      width={size}
      height={Math.round((size * 132) / 120)}
      role="img"
      aria-label={title}
      className={`shrink-0 ${earned ? "" : "opacity-25 grayscale"} ${className}`}
    >
      <title>{title}</title>
      <path d="M60 4 113 34v64L60 128 7 98V34Z" className="fill-navy-900 stroke-neon" strokeWidth="5" strokeLinejoin="round" />
      <path d="M60 15 103 39.5v53L60 117 17 92.5v-53Z" fill="none" className="stroke-pink" strokeWidth="1.5" strokeLinejoin="round" />
      {/* speed stripes */}
      <g className="stroke-pink" strokeWidth="3" strokeLinecap="round">
        <path d="M30 44 40 34" />
        <path d="M30 53 47 36" />
        <path d="M30 62 54 38" />
      </g>
      <text
        x="60"
        y="80"
        textAnchor="middle"
        className="fill-highlight"
        fontSize="36"
        fontWeight="800"
        letterSpacing="1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        MVP
      </text>
      <text
        x="60"
        y="99"
        textAnchor="middle"
        className="fill-ink"
        fontSize={fit(caption, 9, 78)}
        letterSpacing="0.6"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {caption}
      </text>
    </svg>
  );
}
