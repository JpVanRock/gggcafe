// The shared building blocks for every page. Server-safe (no client hooks), so server and client
// components can both use them. Colors come from the brand tokens in src/app/globals.css; use
// them by role (text-highlight, text-link, text-on-accent), never text-neon or zinc/gray.
//
// Type scale: one size per job. Nothing is smaller than text-2xs (tests/unit/ui-rules.test.ts).
//   text-2xs  12px  uppercase labels only: Badge, CountBadge, Eyebrow, table headers, section labels
//   text-xs   13px  hints, captions, timestamps, footnotes (sentence case)
//   text-sm   15px  interface: buttons, form fields, tables, lists, card text
//   text-base 17px  reading: lessons, chapters, long notes and answers
//   text-lg+        titles, in Jost (PageHeader is text-2xl; boards text-xl to text-3xl)
//
// Client pieces live next door: SubmitButton (submit-button.tsx), ConfirmSubmit and useConfirm
// (confirm-submit.tsx), ActionForm (action-form.tsx), Modal (modal.tsx), PillNav (pill-nav.tsx).
import Link from "next/link";
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

// ---- Form fields ------------------------------------------------------------------------------

/** A form field's look without a width: for inputs that set their own (w-20, w-14...). */
export const fieldClass =
  "rounded-md border border-navy-600 bg-navy-950 px-3 py-2 text-ink outline-none placeholder:text-muted/60 focus:border-pink focus:ring-2 focus:ring-pink/30 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

/** A full-width form field. Don't add another w-* to it (both would apply and full width wins): use fieldClass. */
export const inputClass = `w-full ${fieldClass}`;

/**
 * A labeled form field. The label wraps the control, so clicking it focuses the control. When the
 * child is a plain element (<input>, <select>, <textarea>), the hint and error are tied to it with
 * aria-describedby and an error marks it aria-invalid, so screen readers read them with the field.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** a message for this field, shown in red under it */
  error?: string | null;
  /** shows "Required" next to the label (the control still needs its own `required`) */
  required?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control =
    describedBy && isValidElement(children) && typeof children.type === "string"
      ? cloneElement(children as ReactElement<Record<string, unknown>>, { "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
      : children;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="ml-1.5 text-xs font-normal text-muted">Required</span>}
      </span>
      {control}
      {hint && (
        <span id={hintId} className="text-xs text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

/** A server action's result under a form (a client component: it also marks the fields an error names). */
export { FormMessage } from "@/components/form-message";

// ---- Buttons ----------------------------------------------------------------------------------

/**
 * Button looks, for <button>, <Link> and <label>. Pick by job:
 *   primary      the one main action in a form or card (neon)
 *   secondary    other actions next to it
 *   pill         the big actions on a board (Finalize & Print), uppercase
 *   pillOutline  the second big action (Share)
 *   pillQuiet    small actions on a board (New code, Turn off)
 *   danger       delete or remove, when it is the action itself (not the small "Remove" link)
 *   link         an action that reads as a text link
 * Disabled buttons turn grey (not a dimmed neon) and show a not-allowed cursor.
 */
export type ButtonVariant = "primary" | "secondary" | "pill" | "pillOutline" | "pillQuiet" | "danger" | "link";

const BUTTON: Record<ButtonVariant, string> = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-neon px-4 py-2 text-sm font-semibold text-on-accent transition hover:bg-neon-bright disabled:cursor-not-allowed disabled:bg-navy-700 disabled:text-muted",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-navy-600 px-3 py-1.5 text-sm transition hover:border-pink hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50",
  pill: "inline-flex items-center justify-center gap-2 rounded-full bg-neon px-5 py-2 text-sm font-semibold uppercase tracking-wider text-on-accent transition hover:bg-neon-bright disabled:cursor-not-allowed disabled:bg-navy-700 disabled:text-muted",
  pillOutline:
    "inline-flex items-center justify-center gap-2 rounded-full border border-pink px-5 py-2 text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-pink hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-50",
  pillQuiet:
    "inline-flex items-center justify-center gap-2 rounded-full border border-navy-600 px-4 py-2 text-sm transition hover:border-pink hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-md border border-danger/70 px-3 py-1.5 text-sm font-semibold text-danger transition hover:bg-danger hover:text-navy-950 disabled:cursor-not-allowed disabled:opacity-50",
  link: "inline-flex items-center gap-1 text-sm font-semibold text-link hover:underline disabled:cursor-not-allowed disabled:opacity-50",
};

/** The classes for a button look, plus any of your own (margins, width). */
export function buttonStyles(variant: ButtonVariant = "primary", className = "") {
  return className ? `${BUTTON[variant]} ${className}` : BUTTON[variant];
}

export const buttonClass = BUTTON.primary;
export const secondaryButtonClass = BUTTON.secondary;
/** Pill buttons for the big actions (Finalize & Print, Finalize & Share). */
export const pillButtonClass = BUTTON.pill;
export const pillOutlineClass = BUTTON.pillOutline;
export const pillQuietClass = BUTTON.pillQuiet;

/** A small spinning ring for a button that is working (SubmitButton uses it). Still with reduced motion. */
export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`inline-block size-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin ${className}`} />;
}

// ---- Labels, badges and counts ------------------------------------------------------------------

/** Small uppercase pink label for a card or section heading, echoing "CAFE" in the logo. */
export const sectionLabelClass = "text-2xs font-semibold uppercase tracking-[0.14em] text-pink-soft";

/** The typewriter kicker above a title or a group ("FROM THE DUGOUT", "PLAYER MENU"). */
export const eyebrowClass = "font-mono text-2xs uppercase tracking-widest text-pink-soft";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={className ? `${eyebrowClass} ${className}` : eyebrowClass}>{children}</p>;
}

/**
 * Status chip colors, by meaning:
 *   neutral      not started, view only, nothing urgent
 *   ink          a step up from neutral (a middle rating)
 *   pink         draft, in progress, waiting (outlined)
 *   pinkSolid    an event or the current state
 *   neonOutline  earned or highlighted, without shouting
 *   neon         done, final, approved, game-ready
 *   danger       missing or failed
 */
export type BadgeTone = "neutral" | "ink" | "pink" | "pinkSolid" | "neonOutline" | "neon" | "danger";

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "border-navy-600 text-muted",
  ink: "border-navy-600 text-ink",
  pink: "border-pink/70 text-pink-soft",
  pinkSolid: "border-pink bg-pink text-on-accent",
  neonOutline: "border-neon/70 text-highlight",
  neon: "border-neon bg-neon text-on-accent",
  danger: "border-danger/70 text-danger",
};

/**
 * The classes for a status chip. `md` is for chips that are buttons (the install checklist's
 * status picker): 32px tall, an easy tap on a phone.
 */
export function badgeClass(tone: BadgeTone = "neutral", size: "sm" | "md" = "sm") {
  const box = size === "md" ? "min-h-8 px-2.5 py-1" : "px-1.5 py-0.5";
  return `inline-flex items-center gap-1 rounded border ${box} font-mono text-2xs font-bold uppercase tracking-wider whitespace-nowrap ${BADGE_TONE[tone]}`;
}

/** A short status word in a chip: FINAL, GAME-READY, VIEW ONLY. Two words at most. */
export function Badge({ tone = "neutral", title, children }: { tone?: BadgeTone; title?: string; children: ReactNode }) {
  return (
    <span className={badgeClass(tone)} title={title}>
      {children}
    </span>
  );
}

/**
 * A round count next to a menu item or tab (approvals waiting, new notifications). Nothing at 0;
 * "99+" past 99. `label` is what screen readers hear instead of the bare number ("3 approvals waiting").
 */
export function CountBadge({ count, label, tone = "pink" }: { count: number; label: string; tone?: "pink" | "neon" }) {
  if (!(count > 0)) return null;
  return (
    <span
      className={`inline-grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-2xs font-bold text-on-accent ${tone === "neon" ? "bg-neon" : "bg-pink"}`}
      title={label}
    >
      <span aria-hidden>{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

// ---- Page structure ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  back,
  children,
}: {
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string };
  /** actions on the right (a button or two); they wrap under the title on phones */
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link href={back.href} className="text-sm text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-highlight">{title}</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}

/**
 * A card's box for anything that isn't a titled <Card> (a list item, a tile, a form): `raised` sits
 * on the page, `inset` is a quieter box inside a card. Add your own padding.
 */
export function cardClass(tone: "raised" | "inset" = "raised") {
  return `rounded-xl border border-navy-700 ${tone === "inset" ? "bg-navy-950/40" : "bg-navy-900/70"}`;
}

/**
 * A card: a titled section of a page. `raised` (the default) sits on the page; `inset` is a
 * quieter box inside another card. Corners are rounded-xl (boards may go to rounded-2xl).
 */
export function Card({
  title,
  children,
  actions,
  tone = "raised",
  className = "",
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  tone?: "raised" | "inset";
  className?: string;
}) {
  return (
    <section className={`${cardClass(tone)} p-4 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className={sectionLabelClass}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** A collapsible panel for forms ("Add a team", "Edit details"). */
export function Disclosure({ summary, children, open }: { summary: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-navy-700 bg-navy-900/70">
      <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-semibold select-none hover:bg-navy-800">
        <span aria-hidden className="mr-2 inline-block text-link transition group-open:rotate-90">
          ›
        </span>
        {summary}
      </summary>
      <div className="border-t border-navy-700 p-4">{children}</div>
    </details>
  );
}

// ---- States: empty and loading ----------------------------------------------------------------

/**
 * What a list or section shows when there is nothing in it yet. Say what will appear here and,
 * when the viewer can fix it, give them the action ("+ Add a game").
 */
export function EmptyState({ title, children, action }: { title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-navy-600 p-6 text-center">
      {title && <p className="font-semibold text-ink">{title}</p>}
      {children && <p className={`text-sm text-muted ${title ? "mt-1" : ""}`}>{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * The placeholder while a page streams in (every loading.tsx): the shape of a page title and two
 * cards, gently pulsing (still for reduced motion). Screen readers hear "Loading…" once.
 */
export function Loading({ label = "Loading…" }: { label?: string }) {
  const bar = "rounded-md bg-navy-800 motion-safe:animate-pulse";
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="space-y-3">
        <div className={`h-7 w-56 max-w-full ${bar}`} />
        <div className="h-0.5 w-12 rounded-full bg-pink/60" />
        <div className={`h-4 w-96 max-w-full ${bar}`} />
      </div>
      <div aria-hidden className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border border-navy-700 bg-navy-900/70 p-4">
            <div className={`h-3 w-28 ${bar}`} />
            <div className={`h-4 w-full ${bar}`} />
            <div className={`h-4 w-4/5 ${bar}`} />
            <div className={`h-4 w-2/3 ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Tables -----------------------------------------------------------------------------------

export const tableClass = "w-full text-left text-sm";
export const thClass = "border-b border-navy-700 py-2 pr-4 text-2xs font-semibold uppercase tracking-wider text-muted";
export const tdClass = "border-b border-navy-800 py-2 pr-4";

/**
 * A wide table that scrolls sideways on phones. The scroll area can be focused and scrolled with
 * the arrow keys, and screen readers announce it by `label` ("Batting stats").
 */
export function TableScroll({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={`overflow-x-auto ${className}`}>
      {children}
    </div>
  );
}

/** How many past items a list shows before "Show all" (plans, lineups, games). */
export const RECENT_LIMIT = 30;

/** "Showing 30 of 84 · Show all" under a list that was cut to RECENT_LIMIT. */
export function ShowAllLink({ shown, total, href, noun }: { shown: number; total: number; href: string; noun: string }) {
  if (total <= shown) return null;
  return (
    <p className="mt-3 text-sm text-muted">
      Showing the latest {shown} of {total} {noun}.{" "}
      <Link href={href} className="font-semibold text-link hover:underline">
        Show all
      </Link>
    </p>
  );
}

// ---- Page chrome ------------------------------------------------------------------------------

/** "Skip to content": the first thing a keyboard user tabs to; jumps past the menu to <main id="main">. */
export function SkipLink() {
  return (
    <a
      href="#main"
      // parked above the top edge until it has focus, then slides into view
      className="fixed top-3 left-3 z-50 -translate-y-24 rounded-md bg-neon px-4 py-2 text-sm font-semibold text-on-accent shadow-lg transition focus:translate-y-0"
    >
      Skip to content
    </a>
  );
}
