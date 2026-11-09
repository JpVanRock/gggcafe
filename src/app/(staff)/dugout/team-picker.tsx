import Link from "next/link";
import { PillNav } from "@/components/pill-nav";
import { EmptyState } from "@/components/ui";

export type OwnTeam = { id: string; name: string };

/** Pills to switch teams in the Dugout; hidden when there's only one team. */
export function TeamPicker({ teams, current, basePath }: { teams: OwnTeam[]; current: string; basePath: string }) {
  if (teams.length < 2) return null;
  return <PillNav label="Choose team" size="sm" current={current} items={teams.map((t) => ({ key: t.id, label: t.name, href: `${basePath}?team=${t.id}` }))} />;
}

/** The team a Dugout page shows: the one in `?team=`, else the first (callers check the list isn't empty). */
export function pickTeam<T extends { id: string }>(teams: T[], param: string | string[] | undefined): T {
  return teams.find((t) => t.id === param) ?? teams[0];
}

/** What a Dugout page shows before we have a team of our own. */
export function NoOwnTeam() {
  return (
    <EmptyState>
      Add your team on the{" "}
      <Link href="/teams" className="text-link hover:underline">
        Teams
      </Link>{" "}
      page first (mark it as one of our teams).
    </EmptyState>
  );
}
