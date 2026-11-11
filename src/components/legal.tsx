// The Terms of Service and Privacy & Security pages, and the short notices placed next to
// workouts and rewards (words in src/lib/legal.ts; docs/features/legal.md).
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { CornerThemeToggle } from "@/components/theme-toggle";
import { EFFECTIVE_DATE, type LegalBlock, type LegalSection } from "@/lib/legal";

const linkClass = "text-link underline underline-offset-2 hover:text-ink";

/** A public page for a legal document: logo, a way back (the installed app has no back button), the text. */
export function LegalPageShell({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <CornerThemeToggle />
      <div className="flex items-center gap-4">
        <Link href="/" aria-label="GGG.Cafe home">
          <Logo size={56} className="h-14 w-14" />
        </Link>
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
          ← Back to GGG.Cafe
        </Link>
      </div>
      {children}
    </main>
  );
}

function Block({ block, strong }: { block: LegalBlock; strong?: boolean }) {
  const text = strong ? "font-semibold text-ink" : "";
  if (typeof block === "string") return <p className={text}>{block}</p>;
  return (
    <ul className={`flex list-disc flex-col gap-1.5 pl-5 marker:text-pink-soft ${text}`}>
      {block.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * A full legal document: title, date, an optional boxed notice (the Terms' arbitration notice), contents,
 * numbered sections (anchors match each section's id).
 */
export function LegalDocument({
  title,
  intro,
  sections,
  other,
  notice,
}: {
  title: string;
  intro: string[];
  sections: LegalSection[];
  other: { href: string; label: string };
  notice?: string;
}) {
  return (
    <article className="flex flex-col gap-8 text-sm leading-relaxed text-ink">
      <header>
        <h1 className="text-2xl font-semibold tracking-[0.08em] text-highlight uppercase">{title}</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        <p className="mt-3 text-muted">Effective {EFFECTIVE_DATE}</p>
      </header>
      {notice && <p className="rounded-xl border-2 border-pink bg-pink/5 p-4 font-semibold sm:p-5">{notice}</p>}
      <div className="flex flex-col gap-3">
        {intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p>
          See also our{" "}
          <Link href={other.href} className={linkClass}>
            {other.label}
          </Link>
          .
        </p>
      </div>
      <nav aria-label={`${title}: contents`} className="rounded-xl border border-navy-700 bg-navy-900/60 p-4 sm:p-5">
        <p className="text-2xs font-semibold tracking-[0.14em] text-pink-soft uppercase">Contents</p>
        <ol className="mt-3 grid list-decimal gap-x-8 gap-y-1.5 pl-5 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-muted underline-offset-2 hover:text-ink hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className={`scroll-mt-20 flex flex-col gap-3 ${s.conspicuous ? "border-l-2 border-pink pl-4" : ""}`}>
          <h2 id={`${s.id}-title`} className="text-lg font-semibold text-highlight">
            {i + 1}. {s.title}
          </h2>
          {s.blocks.map((b, j) => (
            <Block key={j} block={b} strong={s.conspicuous} />
          ))}
        </section>
      ))}
    </article>
  );
}

/** The short notice next to workouts, drills, routines and practice plans. */
export function SafetyNote({ audience, className = "" }: { audience: "player" | "coach"; className?: string }) {
  return (
    <p role="note" className={`rounded-xl border border-navy-700 bg-navy-950/40 px-4 py-3 text-sm text-muted ${className}`}>
      <strong className="font-semibold text-highlight">Train smart.</strong>{" "}
      {audience === "player"
        ? "Warm up, use good form and stop if anything hurts. Workouts and drills here, including ones you or your coaches add, are done at your own risk and aren't medical advice. Check with a doctor before starting a new program."
        : "Drills, workouts and routines are done at your own risk and aren't medical advice. Check that each one suits your players' age, health and ability, and supervise them."}{" "}
      <Link href="/terms#risk" className={linkClass}>
        Terms, section 4
      </Link>
    </p>
  );
}

/** The short notice next to points, leaderboards, badges and awards. */
export function RewardsNote({ className = "" }: { className?: string }) {
  return (
    <p role="note" className={`text-sm text-muted ${className}`}>
      Points, badges and awards are for fun and motivation. They have no cash value and aren&apos;t official rankings.{" "}
      <Link href="/terms#rewards" className={linkClass}>
        Terms, section 7
      </Link>
    </p>
  );
}
