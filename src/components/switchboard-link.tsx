"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The pill itself: filled while you're on the Switchboard. */
export function SwitchboardLink() {
  const path = usePathname();
  // not over a View as preview of a parent's or a mentor's page (user, 2026-11-13)
  if (/^\/view-as\/(parent|mentor)\//.test(path)) return null;
  const here = path.startsWith("/switchboard");
  return (
    <Link
      href="/switchboard"
      aria-current={here ? "page" : undefined}
      className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-4 text-xs font-bold tracking-[0.14em] uppercase transition ${
        here ? "border-pink bg-pink text-on-accent" : "border-pink/70 text-ink hover:bg-pink hover:text-on-accent"
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </svg>
      Switchboard
    </Link>
  );
}
