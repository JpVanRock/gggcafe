// A page's own links, shown in the open under its title (the family menu: Season Forms, Logins & Teams,
// Join Another Team). They used to sit behind a second "Menu" button next to the header's; a parent on a
// phone met two Menu buttons and the core pages were hidden (design audit 2026-11-18, N2). Each link
// carries a note from tablets up and, when something waits there, a pink badge.
import Link from "next/link";
import { badgeClass } from "@/components/ui";

export type PageMenuItem = { href: string; label: string; note?: string; badge?: string | null };

export function PageLinks({ items, label }: { items: PageMenuItem[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={label}>
      <ul className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="flex h-full min-h-11 items-center justify-between gap-3 rounded-xl border border-navy-700 bg-navy-900/60 px-4 py-2.5 transition hover:border-pink hover:bg-navy-800"
            >
              <span className="min-w-0">
                <span className="block font-display text-base font-bold tracking-wide text-ink uppercase">{i.label}</span>
                {i.note && <span className="hidden text-xs text-muted sm:block">{i.note}</span>}
              </span>
              {i.badge ? (
                <span className={`${badgeClass("pink")} shrink-0`}>{i.badge}</span>
              ) : (
                <span aria-hidden="true" className="shrink-0 text-link">
                  →
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
