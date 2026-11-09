"use client";

// A row of tabs that scrolls sideways when it doesn't fit (the Coaches Dugout tabs, a player's
// sections). On a phone you can't see that more tabs exist, so the row:
//   - fades out at whichever edge has more tabs past it, and
//   - scrolls the current tab (aria-current="page") into view when the page changes.
// Children are the tab list itself (<ul>…</ul>). `current` is the page's path (or anything that
// changes with the current tab); the parent passes it so this also works in loading fallbacks.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function TabRow({ label, current = "", children }: { label: string; current?: string; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ before: false, after: false });

  // which edges have tabs past them: on scroll and whenever the row changes size
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const before = el.scrollLeft > 4;
      const after = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setMore((m) => (m.before === before && m.after === after ? m : { before, after }));
    };
    const ro = new ResizeObserver(measure); // also measures once right away
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  // bring the current tab into view (centered) when it's off screen
  useEffect(() => {
    const el = scroller.current;
    const tab = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !tab) return;
    const start = tab.offsetLeft;
    const end = start + tab.offsetWidth;
    if (start < el.scrollLeft || end > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, start - (el.clientWidth - tab.offsetWidth) / 2);
    }
  }, [current]);

  const fade = "pointer-events-none absolute inset-y-0 w-10 from-navy-950 to-transparent transition-opacity duration-200";
  return (
    <nav aria-label={label} className="relative -mx-4">
      <div ref={scroller} className="overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <span aria-hidden className={`${fade} left-0 bg-linear-to-r ${more.before ? "opacity-100" : "opacity-0"}`} />
      <span aria-hidden className={`${fade} right-0 bg-linear-to-l ${more.after ? "opacity-100" : "opacity-0"}`} />
    </nav>
  );
}
