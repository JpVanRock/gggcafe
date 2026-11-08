// Leader Badge: earned with the Certificate of Leadership (G3 Leadership Guide,
// every core lesson, a committed plan and the coach's sign-off). Hexagon like the
// MVP badge and the training achievements, with a pink edge and three neon rank
// chevrons climbing up: the leadership ladder. Shown next to her name on her
// dashboard and on the Dugout roster, only to coaches/admins and the player
// herself (the certificate table's RLS decides; this just draws it).
// Plain SVG, no gradients or ids, so any number can sit on one page.

export const LEADER_BADGE_TITLE = "Team Leader · G3 Leadership Guide";

export function LeaderBadge({
  size = 24,
  label = false,
  className = "",
}: {
  /** width in pixels */
  size?: number;
  /** spell out LEADER under the chevrons (for the bigger sizes) */
  label?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 132"
      width={size}
      height={Math.round((size * 132) / 120)}
      role="img"
      aria-label={LEADER_BADGE_TITLE}
      className={`inline-block shrink-0 align-middle ${className}`}
    >
      <title>{LEADER_BADGE_TITLE}</title>
      <path d="M60 4 113 34v64L60 128 7 98V34Z" className="fill-navy-900 stroke-pink" strokeWidth="7" strokeLinejoin="round" />
      <path d="M60 17 101.5 40.5v51L60 115 18.5 91.5v-51Z" fill="none" className="stroke-neon" strokeWidth="2" strokeLinejoin="round" />
      {/* three rank chevrons: the ladder, climbing */}
      <g className="stroke-neon" fill="none" strokeWidth={label ? 9 : 11} strokeLinecap="round" strokeLinejoin="round">
        {label ? (
          <>
            <path d="M36 50 60 34l24 16" />
            <path d="M36 66 60 50l24 16" />
            <path d="M36 82 60 66l24 16" className="stroke-pink" />
          </>
        ) : (
          <>
            <path d="M33 56 60 37l27 19" />
            <path d="M33 75 60 56l27 19" />
            <path d="M33 94 60 75l27 19" className="stroke-pink" />
          </>
        )}
      </g>
      {label && (
        <text
          x="60"
          y="103"
          textAnchor="middle"
          className="fill-highlight"
          fontSize="15"
          fontWeight="800"
          letterSpacing="2.5"
          style={{ fontFamily: "var(--font-display)" }}
        >
          LEADER
        </text>
      )}
    </svg>
  );
}
