import Link from "next/link";

export type OwnTeam = { id: string; name: string };

/** Pills to switch teams in the Dugout; hidden when there's only one team. */
export function TeamPicker({ teams, current, basePath }: { teams: OwnTeam[]; current: string; basePath: string }) {
  if (teams.length < 2) return null;
  return (
    <nav aria-label="Choose team" className="flex flex-wrap gap-2">
      {teams.map((t) => {
        const active = t.id === current;
        return (
          <Link
            key={t.id}
            href={`${basePath}?team=${t.id}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1 text-sm font-semibold transition ${
              active ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
            }`}
          >
            {t.name}
          </Link>
        );
      })}
    </nav>
  );
}
