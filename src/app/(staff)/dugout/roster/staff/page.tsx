import type { Metadata } from "next";
import Link from "next/link";
import { isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Disclosure, EmptyState, buttonClass, sectionLabelClass } from "@/components/ui";
import { DUTY_PHASES, DUTY_PHASE_LABEL, STARTER_DUTIES } from "@/lib/staff-duties";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { loadStarterDuties } from "./actions";
import { AddDutyForm, DutyMatrixForm, StaffStandardsForm, type DutyRow } from "./forms";
import { ActionForm } from "@/components/action-form";

export const metadata: Metadata = { title: "Staff Duties · Coaches Dugout · GGG.Cafe" };

export default async function StaffDutiesPage({ searchParams }: PageProps<"/dugout/roster/staff">) {
  const user = await requireStaffPage();
  const head = isHeadCoach(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;

  const [dutiesResult, standardsResult, staffResult] = await Promise.all([
    supabase.from("staff_duties").select("id, phase, duty, owner").eq("team_id", team.id).order("position"),
    supabase.from("staff_standards").select("commitment, pre_practice").eq("team_id", team.id).maybeSingle(),
    supabase.from("staff").select("display_name, role").in("role", ["coach", "assistant", "admin"]).order("display_name"),
  ]);
  const duties = (dutiesResult.data ?? []) as DutyRow[];
  const standards = (standardsResult.data as { commitment: string[]; pre_practice: string[] } | null) ?? { commitment: [], pre_practice: [] };
  const names = [...((staffResult.data ?? []) as { display_name: string }[]).map((s) => s.display_name), "Parents (rotating)"];
  const empty = duties.length === 0 && standards.commitment.length === 0 && standards.pre_practice.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <Link href={`/dugout/roster?team=${team.id}`} className="text-sm text-muted hover:text-ink">
        ← Roster · {team.name}
      </Link>
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/roster/staff" />
      <div>
        <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">Staff duties & standards</h2>
        <p className="mt-1 text-sm text-muted">
          Who runs each station, each game-day job and each season job. The &ldquo;during the game&rdquo; jobs fill a lineup&apos;s game-day jobs in GameDay.
        </p>
      </div>

      {empty && (
        <EmptyState>
          Nothing set up yet.
          {head && (
            <ActionForm action={loadStarterDuties} className="mt-3">
              <input type="hidden" name="team_id" value={team.id} />
              <button type="submit" className={buttonClass}>
                Load the starter matrix ({STARTER_DUTIES.length} jobs) and standards
              </button>
            </ActionForm>
          )}
        </EmptyState>
      )}

      {(standards.commitment.length > 0 || standards.pre_practice.length > 0 || head) && !empty && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Staff commitment">
            {standards.commitment.length ? (
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
                {standards.commitment.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">Not written yet.</p>
            )}
          </Card>
          <Card title="Before every practice">
            {standards.pre_practice.length ? (
              <ul className="flex flex-col gap-1.5 text-sm">
                {standards.pre_practice.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-sm border border-pink" />
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Not written yet.</p>
            )}
          </Card>
        </div>
      )}
      {head && !empty && (
        <Disclosure summary="Edit the standards">
          <StaffStandardsForm teamId={team.id} commitment={standards.commitment} prePractice={standards.pre_practice} />
        </Disclosure>
      )}

      {duties.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className={sectionLabelClass}>Duty matrix</h3>
          {head ? (
            <DutyMatrixForm duties={duties} names={names} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {DUTY_PHASES.map((phase) => {
                const list = duties.filter((d) => d.phase === phase);
                if (list.length === 0) return null;
                return (
                  <Card key={phase} title={DUTY_PHASE_LABEL[phase]}>
                    <ul className="flex flex-col gap-1 text-sm">
                      {list.map((d) => (
                        <li key={d.id} className="flex justify-between gap-3">
                          <span className="text-muted">{d.duty}</span>
                          <span className="font-semibold">{d.owner ?? "–"}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}
      {head && !empty && (
        <Disclosure summary="Add a job">
          <AddDutyForm teamId={team.id} />
        </Disclosure>
      )}
    </div>
  );
}
