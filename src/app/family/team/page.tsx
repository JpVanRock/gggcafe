import type { Metadata } from "next";
import { EmptyState } from "@/components/ui";
import { loadFamily } from "../family-data";
import { loadTeamCulture } from "../team-data";
import { TeamCultureSection, hasTeamCulture } from "../team-sections";
import { FamilyShell, SectionTitle } from "../shell";

export const metadata: Metadata = { title: "Team Standards & Culture · GGG.Cafe" };

// The family menu's Team Standards & Culture (user, 2026-11-13): each team's standards, culture
// statement and season goals, as the players see them. The parent switch "Team Standards &
// Culture" closes it per team.
export default function FamilyTeamPage() {
  return (
    <FamilyShell>
      <FamilyTeam />
    </FamilyShell>
  );
}

async function FamilyTeam() {
  const { supabase, teamsWith } = await loadFamily();
  const teams = (await loadTeamCulture(supabase, teamsWith("parent.team"))).filter(hasTeamCulture);
  return (
    <div className="flex flex-col gap-10">
      <SectionTitle title="Team Standards & Culture" line="What the team expects of every player and the team it wants to be, from the coaches." />
      {teams.length === 0 ? (
        <EmptyState>Your team&apos;s coaches haven&apos;t posted standards or culture yet.</EmptyState>
      ) : (
        teams.map((t) => <TeamCultureSection key={t.team.id} data={t} showTeam={teams.length > 1} />)
      )}
    </div>
  );
}
