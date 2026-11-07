"use client";

import { useActionState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { PRACTICE_SETTINGS, PRACTICE_SETTING_LABEL, TOTAL_TIME_OPTIONS, durationLabel } from "@/lib/dugout";
import { initialFormState } from "@/lib/form";
import { createPracticePlan } from "./actions";

/** Pill radio buttons, e.g. Outdoor / Indoor. */
export function SettingPills({ name, value, onChange }: { name: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-full border border-navy-600 p-0.5">
      {PRACTICE_SETTINGS.map((s) => (
        <label
          key={s}
          className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold text-muted transition select-none has-checked:bg-pink has-checked:text-on-accent has-focus-visible:ring-2 has-focus-visible:ring-pink/40"
        >
          <input
            type="radio"
            name={name}
            value={s}
            className="sr-only"
            {...(onChange ? { checked: value === s, onChange: () => onChange(s) } : { defaultChecked: s === (value ?? "outdoor") })}
          />
          {PRACTICE_SETTING_LABEL[s]}
        </label>
      ))}
    </div>
  );
}

export function NewPlanForm({ teamId, today }: { teamId: string; today: string }) {
  const [state, action, pending] = useActionState(createPracticePlan, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="team_id" value={teamId} />
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Indoor or outdoor?</legend>
        <SettingPills name="setting" />
      </fieldset>
      <Field label="Total practice time">
        <select name="total_minutes" defaultValue="120" className={inputClass}>
          {TOTAL_TIME_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {durationLabel(m)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Date">
        <input type="date" name="practice_date" required defaultValue={today} className={inputClass} />
      </Field>
      <Field label="Start time (optional)" hint="Drills get clock times when set">
        <input type="time" name="start_time" step={300} className={inputClass} />
      </Field>
      <Field label="Location (optional)">
        <input name="location" maxLength={120} placeholder="Field 2" className={inputClass} />
      </Field>
      <Field label="Focus (optional)">
        <input name="focus" maxLength={200} placeholder="Defense and relays" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Setting up…" : "Start building"}
        </button>
        <FormMessage error={state.error} />
      </div>
    </form>
  );
}
