import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadYearbook } from "@/lib/yearbook-data";
import { YearbookView } from "@/components/yearbook-view";
import { EmptyState } from "@/components/ui";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";

export const metadata: Metadata = { title: "Yearbook · Coaches Dugout · GGG.Cafe" };

export default async function DugoutYearbookPage({ searchParams }: PageProps<"/dugout/yearbook">) {
  await requireStaffPage();
  const { team: teamParam, season } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const loaded = await loadYearbook(supabase, team.id, typeof season === "string" ? season : null);
  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dugout?team=${team.id}`} className="self-start text-sm text-muted hover:text-ink">
        ← Culture
      </Link>
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/yearbook" />
      <p className="text-sm text-muted">
        What players with G3 Advanced, and their parents, see. You and the parents of those players add photos; tag players so they can find
        themselves.
      </p>
      {loaded ? (
        <YearbookView data={loaded.yearbook} urls={loaded.urls} seasonLink={`/dugout/yearbook?team=${team.id}&season=`} />
      ) : (
        <EmptyState>Couldn&apos;t open this team&apos;s yearbook. Does the team have a season roster yet?</EmptyState>
      )}
    </div>
  );
}
