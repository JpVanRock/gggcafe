// Athletic-brand graphic elements (think media-day graphics and team apparel),
// used instead of cartoon doodles. Decorative only.

/** Big outlined numerals or letters, like a jersey number in the background. */
export function OutlineText({ children, className = "", stroke = "var(--color-navy-600)" }: { children: React.ReactNode; className?: string; stroke?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none font-display leading-none font-bold text-transparent select-none ${className}`}
      style={{ WebkitTextStroke: `1.5px ${stroke}` }}
    >
      {children}
    </span>
  );
}

/** Three thin parallel slashes: a small speed accent. */
export function SpeedStripes({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M8 15 15 1M20 15 27 1M32 15 39 1" />
    </svg>
  );
}
