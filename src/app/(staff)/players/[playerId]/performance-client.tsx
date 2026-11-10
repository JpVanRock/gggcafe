"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { TRAINING_CATEGORY_LABEL, type TrainingCategory } from "@/lib/achievements";
import { WEEKDAYS } from "@/lib/dates";
import { initialFormState } from "@/lib/form";
import { addRoutine } from "./training-actions";
import { SubmitButton } from "@/components/submit-button";

export function RoutineForm({
  playerId,
  category,
  library,
  defaultStart,
}: {
  playerId: string;
  category: TrainingCategory;
  library: { id: string; name: string }[];
  defaultStart: string;
}) {
  const [state, action] = useActionState(addRoutine, initialFormState);
  const [choice, setChoice] = useState(library.length ? "" : "new");
  const isNew = choice === "new";
  const label = TRAINING_CATEGORY_LABEL[category];

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="player_id" value={playerId} />
      <input type="hidden" name="category" value={category} />

      <div className="sm:col-span-2">
        <Field label={`Which ${label.one}?`}>
          <select name="drill_id" required={!isNew} value={choice} onChange={(e) => setChoice(e.target.value)} className={inputClass}>
            <option value="" disabled>
              Choose from the library…
            </option>
            {library.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            <option value="new">+ New {label.one}…</option>
          </select>
        </Field>
      </div>

      {isNew && (
        <fieldset className="grid gap-3 rounded-xl border border-navy-700 p-3 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium">New {label.one} (saved to the library for every player)</legend>
          <p className="text-sm text-muted sm:col-span-2">
            Only add exercises that are safe to do with good form. You&apos;re responsible for what you add, and everyone who uses it does
            so at their own risk.
          </p>
          <div className="sm:col-span-2">
            <Field label="Name">
              <input name="new_name" required className={inputClass} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="How to do it">
              <textarea name="new_description" required rows={2} className={inputClass} />
            </Field>
          </div>
          <Field label="Equipment" hint="Optional">
            <input name="new_equipment" className={inputClass} />
          </Field>
          <Field label="Video link" hint="Optional">
            <input name="new_video_url" type="url" placeholder="https://…" className={inputClass} />
          </Field>
        </fieldset>
      )}

      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Which days?</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {WEEKDAYS.map((d) => (
            <label key={d.n} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="days" value={d.n} className="size-4 accent-pink" />
              {d.short}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">Leave all unticked for “once a week, any day”. Routines show up in TWIS to check off.</p>
      </fieldset>

      <Field label="How much" hint="Sets, reps, time">
        <input name="prescription" placeholder="3 × 12, 30 sec rest" className={inputClass} />
      </Field>
      <Field label="Starts">
        <input type="date" name="starts_on" defaultValue={defaultStart} className={inputClass} />
      </Field>

      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton pendingLabel="Adding…">Add routine</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
