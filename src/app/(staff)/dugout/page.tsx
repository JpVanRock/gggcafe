import type { Metadata } from "next";
import { canEdit, requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState } from "@/components/ui";
import { DugoutStrip } from "@/components/dugout-strip";
import { CultureStatement, StandardsList, hasCulture, type TeamCulture, type TeamStandard } from "@/components/team-standards";
import { loadDugoutTeam } from "./data";
import { StandardsForm } from "./standards-form";
import { NoOwnTeam, TeamPicker } from "./team-picker";
import { CultureTeamSections, type Spotlight } from "./culture-team";
import { MottoForm } from "./culture-forms";
import { loadTeamRoster } from "./training/data";
import type { TeamGoal } from "@/lib/culture";
import { seasonOrCurrent } from "@/lib/roster";

export const metadata: Metadata = { title: "Coaches Dugout · GGG.Cafe" };

export default async function DugoutPage({ searchParams }: PageProps<"/dugout">) {
  const user = await requireHeadCoachPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;

  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;

  const season = await seasonOrCurrent(supabase, team.id, null);
  const [cultureResult, standardsResult, goalsResult, roster, pledgesResult, spotlightsResult] = await Promise.all([
    supabase.from("team_culture").select("headline, statement, motto").eq("team_id", team.id).maybeSingle(),
    supabase.from("team_standards").select("title, detail").eq("team_id", team.id).order("position"),
    supabase.from("team_goals").select("id, phase, title, target, current, unit, achieved_at, position").eq("team_id", team.id),
    loadTeamRoster(supabase, team.id),
    season ? supabase.from("team_pledges").select("player_id, lines, signed_at").eq("team_id", team.id).eq("season_id", season) : Promise.resolve({ data: [] }),
    supabase.from("player_spotlights").select("id, player_name, jersey, headline, body, published_on").eq("team_id", team.id).order("published_on", { ascending: false }).limit(12),
  ]);
  const culture = (cultureResult.data ?? null) as TeamCulture | null;
  const standards = (standardsResult.data ?? []) as TeamStandard[];
  const goals = ((goalsResult.data ?? []) as TeamGoal[]).map((g) => ({ ...g, target: g.target === null ? null : Number(g.target), current: g.current === null ? null : Number(g.current) }));

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

      {editor && <MottoForm key={`motto-${team.id}`} teamId={team.id} motto={culture?.motto ?? null} />}

      <CultureTeamSections
        teamId={team.id}
        goals={goals}
        roster={roster}
        pledges={(pledgesResult.data ?? []) as { player_id: string; lines: Record<string, string>; signed_at: string | null }[]}
        standardTitles={standards.map((st) => st.title)}
        spotlights={(spotlightsResult.data ?? []) as Spotlight[]}
        editor={editor}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">
          What players see above TWIS
        </h2>
        <DugoutStrip teams={[{ team, culture, standards }]} canEdit={false} yearbookHref={`/dugout/yearbook?team=${team.id}`} coachResponsibilities />
        <p className="mt-2 text-xs text-muted">
          Coach&apos;s Responsibilities is for coaches only; players don&apos;t see it. The Yearbook pill shows for players with G3 Advanced. Coaches and
          parents of those players add photos.
        </p>
      </section>
    </div>
  );
}
