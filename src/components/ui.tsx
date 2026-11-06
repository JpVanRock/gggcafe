// Small shared building blocks for staff pages. Server-safe (no hooks).
import Link from "next/link";
import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700";

export const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";

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
          <Link href={back.href} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-medium text-zinc-500">{title}</h2>}
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
    <details open={open} className="group rounded-lg border border-zinc-200 dark:border-zinc-800">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium select-none hover:bg-zinc-50 dark:hover:bg-zinc-900">
        <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
        {summary}
      </summary>
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">{children}</div>
    </details>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">{children}</p>;
}

export function Loading() {
  return <p className="text-sm text-zinc-500">Loading…</p>;
}

export function FormMessage({ error, saved }: { error: string | null; saved?: boolean }) {
  return (
    <p aria-live="polite" className={`min-h-5 text-sm ${error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
      {error ?? (saved ? "Saved." : "")}
    </p>
  );
}

export const tableClass = "w-full text-left text-sm";
export const thClass = "border-b border-zinc-200 py-2 pr-4 font-medium text-zinc-500 dark:border-zinc-800";
export const tdClass = "border-b border-zinc-100 py-2 pr-4 dark:border-zinc-900";
