import type { Metadata } from "next";
import { isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import { PhilosophyView } from "@/components/team-programs";
import { formatLongDateAt } from "@/lib/dates";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { TrainingNav } from "../nav";
import { PhilosophyForm } from "../programs-forms";

export const metadata: Metadata = { title: "Hitting philosophy · Training · Coaches Dugout · GGG.Cafe" };

// The Team Hitting Philosophy (user, 2026-11-12): the head coach writes it, every coach
// reads it, and the team's players see it on their Team page.
export default async function HittingPhilosophyPage({ searchParams }: PageProps<"/dugout/training/hitting">) {
  const user = await requireStaffPage();
  const head = isHeadCoach(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const { data } = await supabase.from("team_hitting_philosophy").select("statement, sections, updated_at").eq("team_id", team.id).maybeSingle();

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/training/hitting" />
      <TrainingNav current="hitting" teamId={team.id} head={head} />
      <div className="max-w-3xl">
        <h2 className="text-2xl leading-tight font-bold tracking-wide text-highlight uppercase sm:text-3xl">Team Hitting Philosophy</h2>
        <p className="mt-2 text-sm text-muted">
          How {team.name} hits: one statement and a few short sections every coach teaches the same way. Players read it on their Team page.
          {data?.updated_at ? ` Last saved ${formatLongDateAt(data.updated_at)}.` : ""}
        </p>
      </div>
      {head ? (
        <PhilosophyForm key={data?.updated_at ?? "new"} teamId={team.id} statement={data?.statement ?? null} sections={data?.sections ?? []} />
      ) : data && (data.statement || data.sections.length) ? (
        <PhilosophyView statement={data.statement} sections={data.sections} />
      ) : (
        <EmptyState>Your head coach hasn&apos;t written it yet.</EmptyState>
      )}
    </div>
  );
}
