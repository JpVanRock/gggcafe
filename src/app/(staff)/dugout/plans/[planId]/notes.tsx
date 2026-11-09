"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClass, sectionLabelClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { NOTE_LIMITS } from "@/lib/install";
import { savePlanExtras } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export type PlanNotes = { objective: string | null; rule_of_day: string | null; announcements: string | null; coach_notes: string | null };
export type CuePlayer = { id: string; short: string };
export type InstallChoice = { id: string; group: string; title: string; status: string };

/**
 * Notes that reach players (objective, rule of the day, announcements, a cue for each
 * player: shown in her TWIS on practice day), coach-only notes, and the installs this
 * practice covers. Editable on final plans too.
 */
export function PlanExtrasForm({
  planId,
  notes,
  cues,
  roster,
  installs,
  picked,
}: {
  planId: string;
  notes: PlanNotes;
  cues: Record<string, string>;
  roster: CuePlayer[];
  installs: InstallChoice[];
  picked: string[];
}) {
  const [state, action] = useActionState(savePlanExtras.bind(null, planId), initialFormState);
  const groups = [...new Set(installs.map((i) => i.group))];
  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Objective" hint="One line: what this practice is for">
          <input name="objective" maxLength={NOTE_LIMITS.objective} defaultValue={notes.objective ?? ""} className={inputClass} />
        </Field>
        <Field label="Rule of the day" hint="One standard everyone holds today">
          <input name="rule_of_day" maxLength={NOTE_LIMITS.rule_of_day} defaultValue={notes.rule_of_day ?? ""} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Announcements" hint="Times, uniforms, what to bring">
            <textarea name="announcements" rows={3} maxLength={NOTE_LIMITS.announcements} defaultValue={notes.announcements ?? ""} className={inputClass} />
          </Field>
        </div>
      </div>

      {roster.length > 0 && (
        <fieldset>
          <legend className={sectionLabelClass}>A cue for each player</legend>
          <p className="mt-1 text-xs text-muted">Only she sees her own cue, in her TWIS on practice day. Leave blank to skip.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {roster.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0 truncate text-muted">{p.short}</span>
                <input name={`cue_${p.id}`} maxLength={NOTE_LIMITS.cue} defaultValue={cues[p.id] ?? ""} placeholder="e.g. Hands inside the ball" className={inputClass} />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {installs.length > 0 && (
        <fieldset>
          <legend className={sectionLabelClass}>Installs this practice</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <div key={g}>
                <p className="font-display text-sm font-bold text-ink">{g}</p>
                <ul className="mt-1 space-y-1">
                  {installs
                    .filter((i) => i.group === g)
                    .map((i) => (
                      <li key={i.id}>
                        <label className="flex items-start gap-2 text-sm">
                          <input type="checkbox" name="install" value={i.id} defaultChecked={picked.includes(i.id)} className="mt-1 accent-pink" />
                          <span>
                            {i.title}
                            {i.status === "game_ready" && <span className="ml-1 font-mono text-2xs tracking-wider text-highlight uppercase">Game-ready</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="Coach notes" hint="Coaches only: players never see these">
        <textarea name="coach_notes" rows={3} maxLength={NOTE_LIMITS.coach_notes} defaultValue={notes.coach_notes ?? ""} className={inputClass} />
      </Field>

      <div className="flex items-center gap-4">
        <SubmitButton>Save notes</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
