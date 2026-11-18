import type { ReactNode } from "react";

/**
 * The board color a section page carries (design audit 2026-11-18, P4: the pink "02 Pop Report" board
 * opened a plain navy page). The title's rule and a band across the top of the card take it, so the page
 * reads as that board opened up; the section menu above carries the board's number.
 */
export type SectionAccent = "neon" | "pink";
const ACCENT: Record<SectionAccent, { rule: string; card: string }> = {
  neon: { rule: "bg-neon", card: "border-t-4 border-t-neon" },
  pink: { rule: "bg-pink", card: "border-t-4 border-t-pink" },
};

/** A player section page: its title, then the section in a card. */
/** `notice`: a short note under the title (the safety note on training, the rewards note on awards). */
export function SectionShell({
  title,
  subtitle,
  notice,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  notice?: ReactNode;
  /** the color of this section's board on her menu */
  accent?: SectionAccent;
  children: ReactNode;
}) {
  const a = accent ? ACCENT[accent] : null;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl leading-tight font-bold tracking-wide text-highlight uppercase sm:text-4xl">{title}</h1>
        <span aria-hidden className={`mt-2 block h-0.5 w-12 rounded-full ${a ? `${a.rule} h-1 w-16` : "bg-pink"}`} />
        {subtitle && <p className="mt-2 font-mono text-xs tracking-[0.2em] text-pink-soft uppercase">{subtitle}</p>}
      </header>
      {notice}
      <div className={`rounded-2xl border border-navy-700 bg-navy-900/70 p-5 sm:p-8 ${a?.card ?? ""}`}>{children}</div>
    </div>
  );
}
