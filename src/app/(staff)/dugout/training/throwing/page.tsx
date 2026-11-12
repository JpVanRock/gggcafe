import type { Metadata } from "next";
import { isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import { PillNav } from "@/components/pill-nav";
import { SafetyNote } from "@/components/legal";
import { ThrowingView } from "@/components/team-programs";
import { formatLongDateAt } from "@/lib/dates";
import { THROW_GROUPS, isThrowGroup, throwGroup } from "@/lib/team-programs";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { TrainingNav } from "../nav";
import { ThrowingForm } from "../programs-forms";

export const metadata: Metadata = { title: "Throwing program · Training · Coaches Dugout · GGG.Cafe" };

// The Throwing Program for position players, not pitchers (user, 2026-11-12), in three
// groups: Outies, Innies and Catchers. The head coach writes each; players see their own
// group's on their Team page.
export default async function ThrowingProgramPage({ searchParams }: PageProps<"/dugout/training/throwing">) {
  const user = await requireStaffPage();
  const head = isHeadCoach(user.staff.role);
  const { team: teamParam, group: groupParam } = await searchParams;
  const grp = isThrowGroup(groupParam) ? groupParam : "outies";
  const group = throwGroup(grp);
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const { data: rows } = await supabase.from("team_throwing_programs").select("grp, intro, steps, updated_at").eq("team_id", team.id);
  const saved = new Map((rows ?? []).map((r) => [r.grp, r]));
  const program = saved.get(grp);

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/training/throwing" />
      <TrainingNav current="throwing" teamId={team.id} head={head} />
      <div className="max-w-3xl">
        <h2 className="text-2xl leading-tight font-bold tracking-wide text-highlight uppercase sm:text-3xl">Throwing Program</h2>
        <p className="mt-2 text-sm text-muted">
          For position players, not pitchers (they have their own program). Three groups: Outies (outfielders), Innies (infielders) and Catchers.
          Each player sees her group&apos;s program on her Team page, picked from her positions.
        </p>
      </div>
      <PillNav
        label="Throwing groups"
        current={grp}
        items={THROW_GROUPS.map((g) => ({
          key: g.key,
          href: `/dugout/training/throwing?team=${team.id}&group=${g.key}`,
          label: `${g.label} · ${g.full}${saved.has(g.key) ? "" : " (not set)"}`,
        }))}
      />
      <SafetyNote audience="coach" />
      {program?.updated_at && <p className="-mt-4 text-xs text-muted">Last saved {formatLongDateAt(program.updated_at)}.</p>}
      {head ? (
        <ThrowingForm key={`${grp}-${program?.updated_at ?? "new"}`} teamId={team.id} grp={grp} intro={program?.intro ?? null} steps={program?.steps ?? []} />
      ) : program && (program.intro || program.steps.length) ? (
        <ThrowingView intro={program.intro} steps={program.steps} />
      ) : (
        <EmptyState>Your head coach hasn&apos;t written the {group.label} program yet.</EmptyState>
      )}
    </div>
  );
}
