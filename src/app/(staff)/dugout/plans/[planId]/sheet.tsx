import { ConfirmSubmit } from "@/components/confirm-submit";
import { DrillTags } from "@/components/drill-tags";
import { FieldLineup } from "@/components/practice-field";
import { Card, EmptyState, pillButtonClass, pillOutlineClass, badgeClass } from "@/components/ui";
import { formatLongDate } from "@/lib/dates";
import { PRACTICE_SETTING_LABEL, durationLabel, equipmentChecklist, planTimeline, practiceRange, type PlanPosition } from "@/lib/dugout";
import type { PracticePlan, RosterPlayer, StaffContact } from "@/lib/practice-plans";
import { deletePracticePlan, reopenPracticePlan, sharePracticePlan } from "../actions";
import { ShareButton } from "./share-button";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";

/** A finalized plan (or any plan, for viewers): read-only, with Print and Share. */
export function PlanSheet({
  plan,
  roster,
  canEdit,
  staff,
  emailReady,
}: {
  plan: PracticePlan;
  roster: RosterPlayer[];
  canEdit: boolean;
  staff: StaffContact[];
  emailReady: boolean;
}) {
  const { slots, used } = planTimeline(plan.start_time, plan.blocks);
  const range = practiceRange(plan.start_time, plan.total_minutes);
  const gear = equipmentChecklist(plan.blocks);
  const byId = new Map(roster.map((p) => [p.id, p.short]));
  const names: Partial<Record<PlanPosition, string[]>> = {};
  for (const s of plan.spots) (names[s.position] ??= []).push(byId.get(s.player_id) ?? "Player");
  const final = plan.status === "final";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{plan.team.name}</p>
            <h2 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">
              {formatLongDate(plan.practice_date)}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {[range, PRACTICE_SETTING_LABEL[plan.setting], durationLabel(plan.total_minutes), plan.location].filter(Boolean).join(" · ")}
            </p>
            {plan.focus && <p className="mt-2 font-semibold">Focus: {plan.focus}</p>}
          </div>
          <span
            className={badgeClass(final ? "neon" : "pink")}
          >
            {final ? (plan.shared_at ? "Final · Shared" : "Final") : "Draft"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/dugout/plans/${plan.id}/pdf`} target="_blank" rel="noopener" className={pillButtonClass}>
            Print / PDF
          </a>
          {canEdit && final && (
            <ShareButton planId={plan.id} action={sharePracticePlan} returnPath={`/dugout/plans/${plan.id}`} staff={staff} label={plan.shared_at ? "Share again" : "Share"} className={pillOutlineClass} emailReady={emailReady} />
          )}
          {canEdit && final && (
            <ActionForm action={reopenPracticePlan}>
              <input type="hidden" name="id" value={plan.id} />
              <SubmitButton variant="pillQuiet">
                Reopen to edit
              </SubmitButton>
            </ActionForm>
          )}
          {canEdit && (
            <ActionForm action={deletePracticePlan} className="ml-auto">
              <input type="hidden" name="id" value={plan.id} />
              <input type="hidden" name="team_id" value={plan.team.id} />
              <ConfirmSubmit message="Delete this practice plan? This can't be undone." className="text-xs text-danger hover:underline">
                Delete plan
              </ConfirmSubmit>
            </ActionForm>
          )}
        </div>
      </header>

      <section aria-label="Practice timeline">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Practice timeline</h2>
          <p className="text-sm text-muted">
            {used} of {plan.total_minutes} min planned
          </p>
        </div>
        {plan.blocks.length === 0 ? (
          <EmptyState>No drills in this plan yet.</EmptyState>
        ) : (
          <ol className="flex flex-col gap-3">
            {plan.blocks.map((b, i) => (
              <li key={i} className="grid gap-x-5 gap-y-2 rounded-xl border border-navy-700 bg-navy-900/70 p-4 sm:grid-cols-[10.5rem_1fr_auto]">
                <p className="font-mono text-xs tracking-wider whitespace-nowrap text-pink-soft">
                  <span className="font-display font-bold text-highlight tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {"  ·  "}
                  {slots[i].label ?? "–"}
                </p>
                <div className="min-w-0">
                  <p className="font-semibold">{b.name}</p>
                  <DrillTags tags={b.tags} className="mt-1" />
                  {b.description && <p className="mt-1.5 text-sm text-muted">{b.description}</p>}
                  {b.video_url && (
                    <a href={b.video_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-link hover:underline">
                      ▶ Watch the drill
                    </a>
                  )}
                  <p className="mt-2 text-sm">
                    {b.coaches.length > 0 && <span className="mr-4">Coach: {b.coaches.join(", ")}</span>}
                    {b.equipment && <span className="text-muted">Equipment: {b.equipment}</span>}
                  </p>
                </div>
                <p className="font-display text-xl font-bold text-highlight tabular-nums sm:text-right">
                  {b.minutes ?? "–"}
                  <span className="ml-1 text-xs font-normal text-muted">min</span>
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
        <Card title="Positions">
          {plan.spots.length ? (
            <div className="mx-auto max-w-lg">
              <FieldLineup players={names} />
            </div>
          ) : (
            <EmptyState>No players placed.</EmptyState>
          )}
        </Card>
        <Card title="Equipment checklist">
          {gear.length ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {gear.map((g) => (
                <li key={g} className="flex items-center gap-2">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm border border-navy-600" />
                  {g}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No equipment listed.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
