// Building blocks for the Mental GP lessons and the coaches' Mental Game course
// (user, 2026-11-12): a labeled part, numbered steps, a callout, the takeaway, and
// the links to the lesson before and after. Server components.
import Link from "next/link";
import type { ReactNode } from "react";
import { SpeedStripes } from "@/components/athletic";
import { eyebrowClass } from "@/components/ui";
import { twoDigits } from "@/lib/mental-lessons";

/** A labeled part of a lesson. `level`: h2 under a page title (h1), h3 under a section title (h2). */
export function LessonPart({ title, level = "h2", children }: { title: string; level?: "h2" | "h3"; children: ReactNode }) {
  const Heading = level;
  return (
    <section className="flex flex-col gap-3">
      <Heading className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">{title}</Heading>
      {children}
    </section>
  );
}

export function LessonParagraphs({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="flex max-w-3xl flex-col gap-3 text-ink/90">
      {paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

export function LessonSteps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <ol className="flex max-w-3xl flex-col gap-4">
      {steps.map((s, i) => (
        <li key={s.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
          <span aria-hidden className="font-display text-2xl leading-none font-bold text-highlight tabular-nums">
            {twoDigits(i + 1)}
          </span>
          <span>
            <span className="block font-semibold">{s.title}</span>
            <span className="block text-sm text-ink/90">{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Who / what pairs: a lesson's game situations. */
export function LessonPairs({ items }: { items: { who: string; text: string }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.who} className="rounded-2xl border border-navy-600 bg-navy-900/60 p-4">
          <dt className="font-display font-bold tracking-wide uppercase">{it.who}</dt>
          <dd className="mt-1 text-sm text-ink/90">{it.text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LessonCallout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="max-w-3xl rounded-2xl border border-neon/40 bg-neon/5 p-5">
      <p className={eyebrowClass}>{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** The one line to remember. */
export function LessonTakeaway({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 border-y border-navy-700 py-6">
      <p className={`${eyebrowClass} flex items-center gap-2`}>
        <SpeedStripes className="h-3 w-9 text-link" />
        {label}
      </p>
      <p className="font-display text-2xl leading-tight font-bold tracking-wide text-highlight uppercase sm:text-3xl">{text}</p>
    </div>
  );
}

type PagerLink = { href: string; label: string } | null;

/** Links to the lesson before and after. */
export function LessonPager({ label, prev, next }: { label: string; prev: PagerLink; next: PagerLink }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap justify-between gap-4 border-t border-navy-700 pt-6 text-sm">
      {prev ? (
        <Link href={prev.href} className="font-semibold text-link hover:underline">
          <span aria-hidden="true">← </span>
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="text-right font-semibold text-link hover:underline">
          {next.label}
          <span aria-hidden="true"> →</span>
        </Link>
      )}
    </nav>
  );
}
