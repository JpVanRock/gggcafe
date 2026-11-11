// Coaches Dugout → Culture (Phase 5): Team Season Goals, the pledge tracker and
// Player Spotlights, under Team Standards and Culture.
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Disclosure, EmptyState, eyebrowClass } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { GOAL_PHASE_LABEL, goalProgress, pledgeStatus, sortGoals, type TeamGoal } from "@/lib/culture";
import { deleteGoal, deleteSpotlight, setGoalAchieved } from "./actions";
import { GoalForm, SpotlightForm } from "./culture-forms";
import { ActionForm } from "@/components/action-form";

const heading = "font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

export type Spotlight = { id: string; player_name: string; jersey: string | null; headline: string; body: string; published_on: string };
type Pledge = { player_id: string; lines: Record<string, string>; signed_at: string | null };

export function GoalsBoard({ goals, teamId, editor }: { goals: TeamGoal[]; teamId?: string; editor?: boolean }) {
  if (goals.length === 0) return <EmptyState>No season goals yet.</EmptyState>;
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {sortGoals(goals).map((g, i) => {
        const pct = goalProgress(g);
        return (
          <li key={g.id} className={`flex gap-4 rounded-xl border p-4 ${g.achieved_at ? "border-neon bg-neon/5" : "border-navy-700"}`}>
            <span className="font-display text-3xl leading-none font-bold text-highlight tabular-nums" aria-label={`Goal ${i + 1}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
            <p className={eyebrowClass}>
              {GOAL_PHASE_LABEL[g.phase]}
              {g.achieved_at && " · Achieved ✓"}
            </p>
            <p className="mt-1 font-semibold">{g.title}</p>
            {g.target !== null && (
              <div className="mt-2">
                <div className="h-2 overflow-hidden rounded-full bg-navy-800" aria-hidden>
                  <div className="h-full bg-linear-to-r from-pink to-neon" style={{ width: `${pct ?? 0}%` }} />
                </div>
                <p className="mt-1 font-mono text-xs text-muted tabular-nums">
                  {g.current ?? 0} / {g.target} {g.unit ?? ""}
                </p>
              </div>
            )}
            {editor && teamId && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ActionForm action={setGoalAchieved}>
                  <input type="hidden" name="id" value={g.id} />
                  {!g.achieved_at && <input type="hidden" name="achieved" value="on" />}
                  <button type="submit" className="text-xs font-semibold text-link hover:underline">
                    {g.achieved_at ? "Mark not achieved" : "Mark achieved"}
                  </button>
                </ActionForm>
                <ActionForm action={deleteGoal}>
                  <input type="hidden" name="id" value={g.id} />
                  <ConfirmSubmit message={`Remove the goal "${g.title}"?`} className="text-xs text-muted hover:text-danger">
                    Remove
                  </ConfirmSubmit>
                </ActionForm>
                <div className="w-full">
                  <Disclosure summary="Edit or update progress">
                    <GoalForm teamId={teamId} goal={g} />
                  </Disclosure>
                </div>
              </div>
            )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CultureTeamSections({
  teamId,
  goals,
  roster,
  pledges,
  spotlights,
  editor,
}: {
  teamId: string;
  goals: TeamGoal[];
  roster: { id: string; name: string; number: string | null }[];
  pledges: Pledge[];
  spotlights: Spotlight[];
  editor: boolean;
}) {
  const signed = roster.filter((p) => pledgeStatus(pledges.find((x) => x.player_id === p.id) ?? null).signed).length;
  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className={heading}>Team Season Goals</h2>
        <GoalsBoard goals={goals} teamId={teamId} editor={editor} />
        {editor && (
          <Disclosure summary="Add a goal" open={goals.length === 0}>
            <GoalForm teamId={teamId} />
          </Disclosure>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>
          Team pledge · {signed} of {roster.length} signed
        </h2>
        <p className="text-sm text-muted">
          Each player writes one &ldquo;I will…&rdquo; commitment that covers every Team Standard and signs the pledge on her Team page.
        </p>
        {roster.length > 0 && (
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {roster.map((p) => {
              const st = pledgeStatus(pledges.find((x) => x.player_id === p.id) ?? null);
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 border-b border-navy-800 py-1">
                  <span>{p.name}</span>
                  <span className={`font-mono text-2xs ${st.complete ? "text-highlight" : "text-muted"}`}>
                    {st.signed ? "Signed" : "Not signed"} · {st.written ? "written" : "not written"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>Player Spotlight</h2>
        <p className="text-sm text-muted">A short feature for the team; it shows on every player&apos;s Team page, with a media-day graphic.</p>
        {editor && roster.length > 0 && (
          <Disclosure summary="Write a spotlight" open={spotlights.length === 0}>
            <SpotlightForm teamId={teamId} roster={roster} />
          </Disclosure>
        )}
        {spotlights.length === 0 ? (
          <EmptyState>No spotlights yet.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {spotlights.map((s) => (
              <li key={s.id} className="rounded-xl border border-navy-700 p-4">
                <p className={eyebrowClass}>
                  {formatDay(s.published_on)} · {s.jersey ? `#${s.jersey} ` : ""}
                  {s.player_name}
                </p>
                <p className="mt-1 font-display text-lg font-bold tracking-wide uppercase">{s.headline}</p>
                <p className="mt-1 line-clamp-3 text-sm text-ink/90">{s.body}</p>
                {editor && (
                  <ActionForm action={deleteSpotlight} className="mt-2">
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmSubmit message="Remove this spotlight?" className="text-xs text-muted hover:text-danger">
                      Remove
                    </ConfirmSubmit>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
