// Cafe-menu building blocks for the player dashboard.
import type { ReactNode } from "react";
import Link from "next/link";
import { OutlineText } from "@/components/athletic";

/**
 * Board colors, all from the brand palette. Add a variant here when a new
 * section needs its own look; outline variants keep the page from getting loud.
 */
const BOARD = {
  neon: {
    board: "bg-neon text-on-accent [--menu-value:var(--color-on-accent)] [--menu-note:rgb(0_10_45/0.75)]",
    subtitle: "text-on-accent/70",
    cta: "text-on-accent",
    numeral: "rgb(0 10 45 / 0.28)",
  },
  pink: {
    board: "bg-pink text-on-accent [--menu-value:var(--color-on-accent)] [--menu-note:rgb(0_10_45/0.8)]",
    subtitle: "text-on-accent/75",
    cta: "text-on-accent",
    numeral: "rgb(0 10 45 / 0.3)",
  },
  navy: {
    board: "bg-navy-700 text-ink [--menu-value:var(--color-highlight)] [--menu-note:var(--color-muted)]",
    subtitle: "text-pink-soft",
    cta: "text-highlight",
    numeral: "color-mix(in srgb, var(--color-highlight) 35%, transparent)",
  },
  outlineNeon: {
    board: "border-2 border-neon bg-navy-900 text-ink [--menu-value:var(--color-highlight)] [--menu-note:var(--color-muted)]",
    subtitle: "text-pink-soft",
    cta: "text-highlight",
    numeral: "color-mix(in srgb, var(--color-highlight) 35%, transparent)",
  },
  trophy: {
    board:
      "border-2 border-neon bg-linear-to-b from-navy-800 to-navy-950 text-ink shadow-[0_0_36px_rgba(254,31,124,0.18)] [--menu-value:var(--color-highlight)] [--menu-note:var(--color-muted)]",
    subtitle: "text-pink-soft",
    cta: "text-highlight",
    numeral: "rgb(254 31 124 / 0.45)",
  },
  // G3 Advanced (Level 2): a premium cover, pink edge with a neon glow
  advanced: {
    board:
      "border-2 border-pink bg-linear-to-br from-navy-950 via-navy-900 to-navy-800 text-ink shadow-[0_0_40px_rgba(231,251,6,0.14)] [--menu-value:var(--color-highlight)] [--menu-note:var(--color-muted)]",
    subtitle: "text-highlight",
    cta: "text-pink-soft",
    numeral: "rgb(231 251 6 / 0.35)",
  },
  outlinePink: {
    board: "border-2 border-pink bg-navy-900 text-ink [--menu-value:var(--color-pink-soft)] [--menu-note:var(--color-muted)]",
    subtitle: "text-highlight",
    cta: "text-pink-soft",
    numeral: "rgb(254 31 124 / 0.45)",
  },
} as const;

export type BoardVariant = keyof typeof BOARD;

export type MenuSection = {
  key: string;
  title: string;
  subtitle?: string;
  variant: BoardVariant;
  /** spans both columns on wide screens */
  wide?: boolean;
  summary: ReactNode;
  /** the section's own page */
  href: string;
};

/**
 * A menu board: shows the summary; clicking anywhere on it opens the section's page.
 * Boards are numbered like menu sections (01, 02...), shown as a large outlined numeral.
 */
export function MenuBoard({ section, number }: { section: MenuSection; number: number }) {
  const style = BOARD[section.variant];
  return (
    <article className={`relative ${section.wide ? "md:col-span-2" : ""}`}>
      <div className={`relative h-full overflow-hidden rounded-2xl p-6 pb-14 sm:p-8 sm:pb-16 ${style.board}`}>
        <OutlineText stroke={style.numeral} className="absolute -top-2 right-3 text-7xl tracking-tight sm:right-5 sm:text-8xl">
          {String(number).padStart(2, "0")}
        </OutlineText>
        <h2 className="relative pr-20 text-3xl leading-none font-bold tracking-wide uppercase sm:pr-28 sm:text-4xl">{section.title}</h2>
        {section.subtitle && (
          <p className={`relative mt-2 font-mono text-xs tracking-[0.2em] uppercase ${style.subtitle}`}>{section.subtitle}</p>
        )}
        <div className="relative mt-6">{section.summary}</div>
        <p aria-hidden className={`absolute bottom-5 left-6 font-mono text-xs tracking-widest uppercase sm:left-8 ${style.cta}`}>
          Full details →
        </p>
        {/* The whole board opens the section's page */}
        <Link
          href={section.href}
          aria-label={`Open ${section.title}`}
          className="absolute inset-0 rounded-2xl transition hover:bg-white/5 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-pink"
        />
      </div>
    </article>
  );
}

/** One menu line: name on the left, its "price" (a value) on the right, a short note under it. */
export function MenuItem({ name, value, note }: { name: string; value?: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="truncate font-mono text-sm tracking-wide uppercase">{name}</span>
        {value !== undefined && value !== null && (
          <span className="shrink-0 text-lg font-bold text-[var(--menu-value)] tabular-nums">{value}</span>
        )}
      </div>
      {note && <p className="mt-1 line-clamp-2 text-sm text-[var(--menu-note)]">{note}</p>}
    </div>
  );
}

/** Heading inside a pop-up. */
export function DetailHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">{children}</h3>;
}
