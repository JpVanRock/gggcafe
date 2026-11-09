"use client";

// Coaches Dugout → Culture (Phase 5): the season motto, Team Season Goals and Player Spotlights.
import { useActionState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { GOAL_PHASES, GOAL_PHASE_LABEL, MOTTO_MAX, SPOTLIGHT, type TeamGoal } from "@/lib/culture";
import { saveGoal, saveMotto, saveSpotlight } from "./actions";

export function MottoForm({ teamId, motto }: { teamId: string; motto: string | null }) {
  const [state, action, pending] = useActionState(saveMotto, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="team_id" value={teamId} />
      <div className="min-w-64 flex-1">
        <Field label="Season motto" hint="A few words players see in From the Dugout">
          <input name="motto" maxLength={MOTTO_MAX} defaultValue={motto ?? ""} placeholder="Every pitch. Every rep. Together." className={inputClass} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save motto"}
      </button>
      <FormMessage error={state.error} saved={state.saved} />
    </form>
  );
}

export function GoalForm({ teamId, goal }: { teamId: string; goal?: TeamGoal }) {
  const [state, action, pending] = useActionState(saveGoal, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="team_id" value={teamId} />
      {goal && <input type="hidden" name="id" value={goal.id} />}
      <div className="sm:col-span-4">
        <Field label="Goal">
          <input name="title" required maxLength={140} defaultValue={goal?.title} placeholder="Win the conference" className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="When">
          <select name="phase" defaultValue={goal?.phase ?? "season"} className={inputClass}>
            {GOAL_PHASES.map((p) => (
              <option key={p} value={p}>
                {GOAL_PHASE_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Target (optional)" hint="A number to track">
          <input name="target" inputMode="decimal" defaultValue={goal?.target ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Progress so far">
          <input name="current" inputMode="decimal" defaultValue={goal?.current ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Unit">
          <input name="unit" maxLength={20} defaultValue={goal?.unit ?? ""} placeholder="wins, runs, %" className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4 sm:col-span-6">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : goal ? "Save goal" : "Add goal"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function SpotlightForm({ teamId, roster }: { teamId: string; roster: { id: string; name: string; number: string | null }[] }) {
  const [state, action, pending] = useActionState(saveSpotlight, initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="team_id" value={teamId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Player">
          <select name="player_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Pick a player…
            </option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number ? `#${p.number} ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Headline">
          <input name="headline" required maxLength={SPOTLIGHT.headline} placeholder="The engine behind the infield" className={inputClass} />
        </Field>
      </div>
      <Field label="Her story" hint="What she's done, how she competes, why her teammates count on her">
        <textarea name="body" required rows={4} maxLength={SPOTLIGHT.body} className={inputClass} />
      </Field>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Publishing…" : "Publish spotlight"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
