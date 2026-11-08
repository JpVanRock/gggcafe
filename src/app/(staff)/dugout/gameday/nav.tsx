import Link from "next/link";

const PAGES = [
  { key: "lineups", href: "/dugout/gameday", label: "Lineups & player cards" },
  { key: "depth", href: "/dugout/gameday/depth", label: "Depth chart" },
  { key: "box", href: "/dugout/gameday/box", label: "Box scores" },
] as const;

/** The GameDay tab's pages. */
export function GamedayNav({ current, teamId }: { current: (typeof PAGES)[number]["key"]; teamId: string }) {
  return (
    <nav aria-label="GameDay" className="flex flex-wrap gap-2">
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
