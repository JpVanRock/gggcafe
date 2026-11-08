import Link from "next/link";

const PAGES = [
  { key: "roadmap", href: "/dugout/training", label: "Roadmap & routines", head: false },
  { key: "testing", href: "/dugout/training/testing", label: "Testing", head: false },
  { key: "bullpens", href: "/dugout/training/bullpens", label: "Bullpens", head: false },
  { key: "bp", href: "/dugout/training/bp", label: "BP rounds", head: false },
  { key: "draft", href: "/dugout/training/draft", label: "Offseason draft", head: true },
] as const;

/** The Training tab's pages; the draft is for head coaches and admins only. */
export function TrainingNav({ current, teamId, head }: { current: (typeof PAGES)[number]["key"]; teamId: string; head: boolean }) {
  return (
    <nav aria-label="Training" className="flex flex-wrap gap-2">
      {PAGES.filter((p) => head || !p.head).map((p) => (
        <Link
          key={p.key}
          href={`${p.href}?team=${teamId}`}
          aria-current={p.key === current ? "page" : undefined}
          className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
            p.key === current ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
