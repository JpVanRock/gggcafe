import Link from "next/link";

const PAGES = [
  { href: "/faq", label: "Player access" },
  { href: "/faq/accounts", label: "Account types" },
] as const;

/** The two admin FAQ pages: Standard vs Advanced player access, and the five account types. */
export function FaqNav({ current }: { current: (typeof PAGES)[number]["href"] }) {
  return (
    <nav aria-label="FAQ pages" className="flex flex-wrap gap-2">
      {PAGES.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.href === current ? "page" : undefined}
          className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
            p.href === current ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
