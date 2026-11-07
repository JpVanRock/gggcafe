"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dugout", label: "Standards & Culture", match: (p: string) => p === "/dugout" },
  { href: "/dugout/plans", label: "Practice Plans", match: (p: string) => p.startsWith("/dugout/plans") },
  { href: "/dugout/drills", label: "Drill Library", match: (p: string) => p.startsWith("/dugout/drills") },
] as const;

/** Header tabs across the Coaches Dugout (the current tab is underlined). */
export function DugoutTabs() {
  return <TabList path={usePathname()} />;
}

/** The tabs for a given path; with no path (while the URL streams in) none is current. */
export function TabList({ path = "" }: { path?: string }) {
  return (
    <nav aria-label="Coaches Dugout" className="-mx-4 overflow-x-auto px-4">
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
