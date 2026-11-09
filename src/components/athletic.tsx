// Athletic-brand graphic elements (think media-day graphics and team apparel),
// used instead of cartoon doodles. Decorative only.

/**
 * Big outlined numerals or letters, like a jersey number in the background. Text is drawn by a CSS
 * pseudo-element, so it is pure decoration: screen readers skip it and contrast checks don't count it.
 */
export function OutlineText({ children, className = "", stroke = "var(--color-navy-600)" }: { children: React.ReactNode; className?: string; stroke?: string }) {
  const cls = `pointer-events-none font-display leading-none font-bold text-transparent select-none ${className}`;
  const style = { WebkitTextStroke: `1.5px ${stroke}` };
  if (typeof children === "string" || typeof children === "number") {
    return <span aria-hidden data-text={String(children)} className={`${cls} before:content-[attr(data-text)]`} style={style} />;
  }
  return (
    <span aria-hidden className={cls} style={style}>
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
