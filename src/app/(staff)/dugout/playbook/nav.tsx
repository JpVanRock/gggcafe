import Link from "next/link";

const PAGES = [
  { key: "plays", href: "/dugout/playbook", label: "Call sheet" },
  { key: "quizzes", href: "/dugout/playbook/quizzes", label: "Team quizzes" },
  { key: "scouting", href: "/dugout/playbook/scouting", label: "Scouting" },
] as const;

/** The Playbook tab's pages. */
export function PlaybookNav({ current, teamId }: { current: (typeof PAGES)[number]["key"]; teamId: string }) {
  return (
    <nav aria-label="Playbook" className="flex flex-wrap gap-2">
      {PAGES.map((p) => (
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
