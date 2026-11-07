"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const SECTIONS = [
  { slug: "goals", label: "Goals" },
  { slug: "pop", label: "Pop Report" },
  { slug: "mental", label: "Mental GP" },
  { slug: "training", label: "Training" },
  { slug: "iq", label: "Softball IQ" },
  { slug: "trophies", label: "Trophy Room" },
  { slug: "team", label: "Team" },
  { slug: "activities", label: "Activities" },
] as const;

/** The menu across the top of every player section page. */
export function SectionNav({ playerId, path = "" }: { playerId: string; path?: string }) {
  const base = `/players/${playerId}`;
  return (
    <nav aria-label="Player sections" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-5 border-b border-navy-700">
        {SECTIONS.map((s) => {
          const href = `${base}/${s.slug}`;
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <li key={s.slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block border-b-2 pb-2.5 text-sm font-semibold tracking-wider uppercase transition ${
                  active ? "border-pink text-highlight" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function LiveSectionNav({ playerId }: { playerId: string }) {
  return <SectionNav playerId={playerId} path={usePathname()} />;
}
