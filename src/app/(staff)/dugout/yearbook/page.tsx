import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadYearbook } from "@/lib/yearbook-data";
import { YearbookView } from "@/components/yearbook-view";
import { EmptyState, Loading } from "@/components/ui";
import { loadOwnTeams } from "../data";
import { TeamPicker } from "../team-picker";

export const metadata: Metadata = { title: "Yearbook · Coaches Dugout · GGG.Cafe" };

export default function DugoutYearbookPage({ searchParams }: PageProps<"/dugout/yearbook">) {
  return (
    <Suspense fallback={<Loading />}>
      <DugoutYearbook searchParams={searchParams} />
    </Suspense>
  );
}

async function DugoutYearbook({ searchParams }: Pick<PageProps<"/dugout/yearbook">, "searchParams">) {
  await requireStaffPage();
  const { team: teamParam, season } = await searchParams;
  const supabase = await createClient();
  const teams = await loadOwnTeams(supabase);
  if (teams.length === 0) return <EmptyState>Add your team on the Teams page first.</EmptyState>;
  const team = teams.find((t) => t.id === teamParam) ?? teams[0];
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
