// Small shared building blocks for staff pages. Server-safe (no hooks).
// Colors come from the brand tokens in src/app/globals.css.
import Link from "next/link";
import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-navy-600 bg-navy-950 px-3 py-2 text-ink outline-none placeholder:text-muted/60 focus:border-pink focus:ring-2 focus:ring-pink/30";

/** Primary action: the logo's neon yellow. */
export const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-neon px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-neon-bright disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md border border-navy-600 px-3 py-1.5 text-sm transition hover:border-pink hover:bg-navy-800 disabled:opacity-60";

export function PageHeader({
  title,
  description,
  back,
  children,
}: {
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string };
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
        <h1 className="text-2xl font-semibold uppercase tracking-[0.08em] text-neon">{title}</h1>
        <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}

/** Small uppercase pink label, echoing "CAFE" in the logo. */
export const sectionLabelClass = "text-xs font-semibold uppercase tracking-[0.14em] text-pink-soft";

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-navy-700 bg-navy-900/70 p-4">
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
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
    <details open={open} className="group rounded-lg border border-navy-700 bg-navy-900/70">
      <summary className="cursor-pointer list-none rounded-lg px-4 py-3 text-sm font-semibold select-none hover:bg-navy-800">
        <span className="mr-2 inline-block text-pink transition group-open:rotate-90">›</span>
        {summary}
      </summary>
      <div className="border-t border-navy-700 p-4">{children}</div>
    </details>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-navy-600 p-6 text-center text-sm text-muted">{children}</p>;
}

export function Loading() {
  return <p className="text-sm text-muted">Loading…</p>;
}

export function FormMessage({ error, saved }: { error: string | null; saved?: boolean }) {
  return (
    <p aria-live="polite" className={`min-h-5 text-sm ${error ? "text-danger" : "text-neon"}`}>
      {error ?? (saved ? "Saved." : "")}
    </p>
  );
}

export const tableClass = "w-full text-left text-sm";
export const thClass = "border-b border-navy-700 py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted";
export const tdClass = "border-b border-navy-800 py-2 pr-4";
