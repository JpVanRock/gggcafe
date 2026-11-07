"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dugout", label: "Culture", match: (p: string) => p === "/dugout" },
  { href: "/dugout/roster", label: "Roster", match: (p: string) => p.startsWith("/dugout/roster") },
  { href: "/dugout/calendar", label: "Calendar", match: (p: string) => p.startsWith("/dugout/calendar") },
  { href: "/dugout/plans", label: "Practice Plans", match: (p: string) => p.startsWith("/dugout/plans") },
  { href: "/dugout/gameday", label: "GameDay", match: (p: string) => p.startsWith("/dugout/gameday") },
  { href: "/dugout/drills", label: "Drill Library", match: (p: string) => p.startsWith("/dugout/drills") },
  { href: "/dugout/budget", label: "Team Budget", match: (p: string) => p.startsWith("/dugout/budget") },
  { href: "/dugout/parents", label: "Parents", match: (p: string) => p.startsWith("/dugout/parents") },
] as const;

/** Header tabs across the Coaches Dugout (the current tab is underlined). */
export function DugoutTabs({ badges }: { badges?: Record<string, number> }) {
  return <TabList path={usePathname()} badges={badges} />;
}

/** The tabs for a given path; with no path (while the URL streams in) none is current. */
export function TabList({ path = "", badges = {} }: { path?: string; badges?: Record<string, number> }) {
  return (
    <nav aria-label="Coaches Dugout" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-6 border-b border-navy-700">
        {TABS.map((tab) => {
          const active = tab.match(path);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block border-b-2 pb-2.5 text-sm font-semibold tracking-wider uppercase transition ${
                  active ? "border-pink text-highlight" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
                {(badges[tab.href] ?? 0) > 0 && (
                  <span
                    className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1 align-text-bottom font-mono text-[10px] font-bold text-on-accent"
                    title={`${badges[tab.href]} waiting for approval`}
                  >
                    {badges[tab.href]}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
