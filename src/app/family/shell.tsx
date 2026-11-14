// The family menu's section pages (user, 2026-11-13): the family header, then "← Family menu" and
// the section's title, media-day style, like a player's section pages.
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Loading } from "@/components/ui";
import { FamilyHeader } from "./header";

export function FamilyShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <FamilyHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </main>
    </div>
  );
}

export function SectionTitle({ title, line, children }: { title: string; line?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/family" className="self-start text-sm text-muted hover:text-ink">
        <span aria-hidden="true">←</span> Family menu
      </Link>
      <header>
        <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Family menu</p>
        <h1 className="mt-1 text-4xl leading-none font-bold tracking-tight text-highlight uppercase sm:text-5xl">{title}</h1>
        {line && <p className="mt-3 max-w-2xl text-sm text-muted">{line}</p>}
      </header>
      {children}
    </div>
  );
}

/** A heading inside a section page (a team's name, a daughter's name). */
export function SectionHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 font-display text-2xl leading-tight font-bold tracking-wide text-highlight uppercase">
      {children}
    </h2>
  );
}
