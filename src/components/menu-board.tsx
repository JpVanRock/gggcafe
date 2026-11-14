// Cafe-menu building blocks (the player dashboard first; the family and mentor menus since
// 2026-11-13): numbered menu boards in brand colors, menu lines, the media-day page header, and
// the "Needs you" strip. Sharp type, outlined numerals, speed stripes; no cartoon art.
import type { ReactNode } from "react";
import Link from "next/link";
import { OutlineText, SpeedStripes } from "@/components/athletic";

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
    // notes and subtitle at 92% / 90% navy: 5:1 on the pink (75-80% fell under 4.5:1; CI, 2026-11-13)
    board: "bg-pink text-on-accent [--menu-value:var(--color-on-accent)] [--menu-note:rgb(0_10_45/0.92)]",
    subtitle: "text-on-accent/90",
    cta: "text-on-accent",
    numeral: "rgb(0 10 45 / 0.3)",
  },
  navy: {
    board: "bg-navy-700 text-ink [--menu-value:var(--color-highlight)] [--menu-note:var(--color-muted)]",
    // Day Game's pink text is 4.2:1 on this board's light fill: the highlight (navy by day) instead
    subtitle: "text-pink-soft day:text-highlight",
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
  return <h3 className="mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">{children}</h3>;
}


/**
 * A numbered board like MenuBoard whose content can hold its own links and buttons (a roster, a
 * form), so the board itself isn't one big link. `cta` adds a "Full details →"-style link at the bottom.
 */
export function MenuPanel({
  number,
  title,
  subtitle,
  variant,
  wide = false,
  cta,
  children,
}: {
  number: number;
  title: string;
  subtitle?: ReactNode;
  variant: BoardVariant;
  wide?: boolean;
  /** the link at the bottom; without an href it shows the label only (an admin's preview of someone's page) */
  cta?: { href?: string; label: string } | null;
  children: ReactNode;
}) {
  const style = BOARD[variant];
  const ctaClass = `relative mt-6 self-start font-mono text-xs tracking-widest uppercase ${style.cta}`;
  return (
    <article className={`relative ${wide ? "md:col-span-2" : ""}`}>
      <div className={`relative flex h-full flex-col overflow-hidden rounded-2xl p-6 sm:p-8 ${style.board}`}>
        <OutlineText stroke={style.numeral} className="absolute -top-2 right-3 text-7xl tracking-tight sm:right-5 sm:text-8xl">
          {String(number).padStart(2, "0")}
        </OutlineText>
        <h2 className="relative pr-20 text-3xl leading-none font-bold tracking-wide uppercase sm:pr-28 sm:text-4xl">{title}</h2>
        {subtitle && <p className={`relative mt-2 font-mono text-xs tracking-[0.2em] uppercase ${style.subtitle}`}>{subtitle}</p>}
        <div className="relative mt-6 flex-1">{children}</div>
        {cta?.href ? (
          <Link href={cta.href} className={`${ctaClass} hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink`}>
            {cta.label} <span aria-hidden="true">→</span>
          </Link>
        ) : cta ? (
          <p className={ctaClass}>
            {cta.label} <span aria-hidden="true">→</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * A home page's media-day header (the family and mentor menus): "/// FAMILY MENU ///", the name big
 * in two tones, a line under it. `start` (a page menu) and `aside` (the team logo) sit on either
 * side: their own row above the name on phones (the menu centered against the logo), and three
 * columns from wide screens, menu | name | logo, all centered on one line so nothing hangs over the
 * page below (user, 2026-11-13). `actions` (a link or two) go under the name.
 */
export function MenuHeader({
  eyebrow,
  first,
  last,
  line,
  start,
  aside,
  actions,
}: {
  eyebrow: string;
  first: string;
  last?: string;
  line?: ReactNode;
  start?: ReactNode;
  aside?: ReactNode;
  actions?: ReactNode;
}) {
  const sides = Boolean(start || aside);
  return (
    <header className={`grid items-center gap-6 pt-1 ${sides ? "lg:grid-cols-[1fr_auto_1fr] lg:gap-8" : ""}`}>
      {sides && (
        // phones: one row; wide screens: its two children become the grid's outer columns
        <div className="flex items-center justify-between gap-4 lg:contents">
          <div className="lg:col-start-1 lg:row-start-1 lg:justify-self-start">{start}</div>
          <div className="lg:col-start-3 lg:row-start-1 lg:justify-self-end">{aside}</div>
        </div>
      )}
      <div className={`text-center ${sides ? "lg:col-start-2 lg:row-start-1" : ""}`}>
        <p className="flex items-center justify-center gap-3 font-mono text-xs tracking-[0.35em] text-pink-soft uppercase">
          <SpeedStripes className="h-3 w-9 text-link" />
          {eyebrow}
          <SpeedStripes className="h-3 w-9 text-link" />
        </p>
        <h1 className="mt-3 text-5xl leading-none font-bold tracking-tight text-highlight uppercase sm:text-7xl">
          {first}
          {last && <span className="text-ink"> {last}</span>}
        </h1>
        {line && <p className="mx-auto mt-4 max-w-2xl font-mono text-sm text-muted">{line}</p>}
        {actions && <div className="mt-4 flex flex-wrap justify-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export type NeedsItem = { key: string; text: ReactNode; href?: string; action?: string };

/** "Needs you": the few things waiting on this person, each with where to do it. Nothing when there's nothing. */
export function NeedsYou({ items, title = "Needs you" }: { items: NeedsItem[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="rounded-2xl border-2 border-pink bg-pink/5 p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-mono text-xs font-bold tracking-[0.2em] text-pink-soft uppercase">
        <span className="grid size-6 place-items-center rounded-full bg-pink font-display text-sm text-on-accent tabular-nums">{items.length}</span>
        {title}
      </h2>
      <ul className="divide-y divide-navy-700">
        {items.map((i) => (
          <li key={i.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
            <span className="min-w-0">{i.text}</span>
            {i.href && (
              <Link href={i.href} className="shrink-0 font-semibold text-link hover:underline">
                {i.action ?? "Open"} <span aria-hidden="true">→</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
