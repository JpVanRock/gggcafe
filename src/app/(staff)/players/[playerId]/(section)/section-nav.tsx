"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TabRow } from "@/components/tab-row";

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

/** G3 Advanced sits after Softball IQ, and only when it's unlocked for her; `hidden`: sections her head coach turned off. */
function sectionsFor(advanced: boolean, hidden: readonly string[] = []) {
  const shown = SECTIONS.filter((s) => !hidden.includes(s.slug));
  if (!advanced) return shown;
  const at = shown.findIndex((s) => s.slug === "iq") + 1;
  return [...shown.slice(0, at), { slug: "advanced", label: "G3 Advanced" }, ...shown.slice(at)];
}

/** The menu across the top of every player section page. */
export function SectionNav({ playerId, path = "", advanced = false, hidden = [] }: { playerId: string; path?: string; advanced?: boolean; hidden?: string[] }) {
  const base = `/players/${playerId}`;
  return (
    <TabRow label="Player sections" current={path}>
      <ul className="flex min-w-max gap-5 border-b border-navy-700">
        {sectionsFor(advanced, hidden).map((s) => {
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
    </TabRow>
  );
}

export function LiveSectionNav({ playerId, advanced = false, hidden = [] }: { playerId: string; advanced?: boolean; hidden?: string[] }) {
  return <SectionNav playerId={playerId} path={usePathname()} advanced={advanced} hidden={hidden} />;
}
