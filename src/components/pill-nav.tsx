import Link from "next/link";

// Pill links for switching between pages or teams (the Dugout's team picker and the
// sub-menus inside Practice Plans, Training, GameDay and Playbook). One component so
// the active/hover styles stay the same everywhere.

export type PillLink = { key: string; href: string; label: string };

const SIZE = {
  /** team picker */
  sm: "px-3.5 py-1 transition",
  /** a tab's sub-menu */
  md: "px-4 py-1.5",
} as const;

export function PillNav({ label, items, current, size = "md" }: { label: string; items: PillLink[]; current: string; size?: keyof typeof SIZE }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          aria-current={p.key === current ? "page" : undefined}
          className={`rounded-full border text-sm font-semibold ${SIZE[size]} ${
            p.key === current ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

/** A sub-menu for one Dugout tab: each page keeps the chosen team (`?team=`). */
export function teamPages<K extends string>(pages: readonly { key: K; href: string; label: string }[], teamId: string): PillLink[] {
  return pages.map((p) => ({ key: p.key, label: p.label, href: `${p.href}?team=${teamId}` }));
}
