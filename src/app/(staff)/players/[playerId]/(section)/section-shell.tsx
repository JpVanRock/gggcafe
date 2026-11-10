import type { ReactNode } from "react";

/** A player section page: its title, then the section in a card. */
/** `notice`: a short note under the title (the safety note on training, the rewards note on awards). */
export function SectionShell({ title, subtitle, notice, children }: { title: string; subtitle?: string; notice?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl leading-tight font-bold tracking-wide text-highlight uppercase sm:text-4xl">{title}</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        {subtitle && <p className="mt-2 font-mono text-xs tracking-[0.2em] text-pink-soft uppercase">{subtitle}</p>}
      </header>
      {notice}
      <div className="rounded-2xl border border-navy-700 bg-navy-900/70 p-5 sm:p-8">{children}</div>
    </div>
  );
}
