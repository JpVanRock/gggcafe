"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dugoutTabsFor, type StaffRole } from "@/lib/roles";
import { CountBadge } from "@/components/ui";

/** A tab is current on its own page and below it (Culture only on /dugout itself). */
const isCurrent = (href: string, path: string) => (href === "/dugout" ? path === "/dugout" : path.startsWith(href));

/** Header tabs across the Coaches Dugout (the current tab is underlined). Assistants get fewer tabs. */
export function DugoutTabs({ badges, role }: { badges?: Record<string, number>; role?: StaffRole }) {
  return <TabList path={usePathname()} badges={badges} role={role} />;
}

/** The tabs for a given path; with no path (while the URL streams in) none is current. */
export function TabList({ path = "", badges = {}, role }: { path?: string; badges?: Record<string, number>; role?: StaffRole }) {
  return (
    <nav aria-label="Coaches Dugout" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-6 border-b border-navy-700">
        {dugoutTabsFor(role).map((tab) => {
          const active = isCurrent(tab.href, path);
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
                  <span className="ml-1.5 align-text-bottom">
                    <CountBadge count={badges[tab.href]} label={`${badges[tab.href]} waiting for approval`} />
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
