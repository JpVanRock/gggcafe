import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, Loading } from "@/components/ui";
import { DugoutStrip } from "@/components/dugout-strip";
import { CultureStatement, StandardsList, hasCulture, type TeamCulture, type TeamStandard } from "@/components/team-standards";
import { loadOwnTeams } from "./data";
import { StandardsForm } from "./standards-form";
import { TeamPicker } from "./team-picker";

export const metadata: Metadata = { title: "Coaches Dugout · GGG.Cafe" };

export default function DugoutPage({ searchParams }: PageProps<"/dugout">) {
  return (
    <Suspense fallback={<Loading />}>
      <StandardsAndCulture searchParams={searchParams} />
    </Suspense>
  );
}

async function StandardsAndCulture({ searchParams }: Pick<PageProps<"/dugout">, "searchParams">) {
  const user = await requireHeadCoachPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;

  const supabase = await createClient();
  const teams = await loadOwnTeams(supabase);
  if (teams.length === 0) {
    return (
      <EmptyState>
        Add your team on the{" "}
        <Link href="/teams" className="text-pink hover:underline">
          Teams
        </Link>{" "}
        page first (mark it as one of our teams).
      </EmptyState>
    );
  }
  const team = teams.find((t) => t.id === teamParam) ?? teams[0];

  const [cultureResult, standardsResult] = await Promise.all([
    supabase.from("team_culture").select("headline, statement").eq("team_id", team.id).maybeSingle(),
    supabase.from("team_standards").select("title, detail").eq("team_id", team.id).order("position"),
  ]);
  const culture = (cultureResult.data ?? null) as TeamCulture | null;
  const standards = (standardsResult.data ?? []) as TeamStandard[];

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout" />

      {editor ? (
        <StandardsForm key={team.id} teamId={team.id} culture={culture} standards={standards} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Team Standards">
            {standards.length ? <StandardsList standards={standards} /> : <EmptyState>No team standards yet.</EmptyState>}
          </Card>
          <Card title="Team Culture">
            {hasCulture(culture) ? <CultureStatement culture={culture} /> : <EmptyState>No team culture yet.</EmptyState>}
          </Card>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">
          What players see above TWIS
        </h2>
        <DugoutStrip teams={[{ team, culture, standards }]} canEdit={false} yearbookHref={`/dugout/yearbook?team=${team.id}`} />
        <p className="mt-2 text-xs text-muted">
          The Yearbook pill shows for players with G3 Advanced. Coaches and parents of those players add photos.
        </p>
      </section>
    </div>
  );
}
