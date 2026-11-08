// A fastpitch softball: optic-yellow (brand neon) with pink stitching, for "included"
// marks (the admin Access FAQ). `off` draws a faint outline for "not included".
// Plain SVG, no ids, so any number can sit on one page.

export function Softball({ off = false, size = 22, label }: { off?: boolean; size?: number; label: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} role="img" aria-label={label} className="inline-block shrink-0 align-middle">
      <title>{label}</title>
      {off ? (
        <circle cx="16" cy="16" r="13" fill="none" className="stroke-navy-600" strokeWidth="2" strokeDasharray="3 3" />
      ) : (
        <>
          <circle cx="16" cy="16" r="14" className="fill-neon stroke-navy-950" strokeWidth="1.5" />
          {/* the two seams */}
          <path d="M8.5 5.2c3.6 3 5.4 6.6 5.4 10.8s-1.8 7.8-5.4 10.8" fill="none" className="stroke-pink" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M23.5 5.2c-3.6 3-5.4 6.6-5.4 10.8s1.8 7.8 5.4 10.8" fill="none" className="stroke-pink" strokeWidth="1.6" strokeLinecap="round" />
          {/* stitches */}
          <g className="stroke-pink" strokeWidth="1.2" strokeLinecap="round">
            <path d="M10.4 8.6l2-1M12 12l2.2-.6M12.4 16h2.4M12 20l2.2.6M10.4 23.4l2 1" />
            <path d="M21.6 8.6l-2-1M20 12l-2.2-.6M19.6 16h-2.4M20 20l-2.2.6M21.6 23.4l-2 1" />
          </g>
        </>
      )}
    </svg>
  );
}
