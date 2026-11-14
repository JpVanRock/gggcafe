"use client";

// A page's own hamburger menu (user, 2026-11-13: top left of the family menu, holding Season forms and
// Logins & teams): a "Menu" button that opens a small panel of links, each with a note and, when
// something waits there, a badge. Closes on Esc (focus back on the button), a tap outside it, or a link.
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { badgeClass, buttonStyles } from "@/components/ui";

export type PageMenuItem = { href: string; label: string; note?: string; badge?: string | null };

export function PageMenu({ items, label = "Menu" }: { items: PageMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const waiting = items.filter((i) => i.badge).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="relative text-left">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={buttonStyles("secondary", "min-h-10")}
      >
        <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="m5 5 10 10M15 5 5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
        </svg>
        {open ? "Close" : label}
        {!open && waiting > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-pink font-display text-2xs text-on-accent tabular-nums" aria-label={`${waiting} need you`}>
            {waiting}
          </span>
        )}
      </button>
      <nav
        id={panelId}
        aria-label={label}
        hidden={!open}
        className="absolute top-full left-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-navy-600 bg-navy-900 p-2 shadow-[0_12px_40px_rgb(0_10_45/0.5)]"
      >
        <ul className="flex flex-col">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                onClick={() => setOpen(false)}
                className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-pink"
              >
                <span className="min-w-0">
                  <span className="block font-display text-base font-bold tracking-wide text-ink uppercase">{i.label}</span>
                  {i.note && <span className="block text-xs text-muted">{i.note}</span>}
                </span>
                {i.badge && <span className={`${badgeClass("pink")} shrink-0`}>{i.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
