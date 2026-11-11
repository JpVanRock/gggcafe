"use client";

// Coaches add a measurement on her POP Report. The date decides the season.
import { useActionState } from "react";
import { Field, fieldClass, inputClass } from "@/components/ui";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { initialFormState } from "@/lib/form";
import { addMeasurement } from "./measurement-actions";

export function MeasurementForm({
  playerId,
  options,
  today,
  todaySeason,
}: {
  playerId: string;
  options: { key: string; name: string; unit: string }[];
  today: string;
  /** "Fall Season 2026": where a value measured today lands */
  todaySeason: string;
}) {
  const [state, action] = useActionState(addMeasurement, initialFormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-navy-700 p-3">
      <input type="hidden" name="player_id" value={playerId} />
      <Field label="Add a measurement">
        <select name="metric_key" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.unit === "score" ? o.name : `${o.name} (${o.unit})`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Value">
        <input name="value" inputMode="decimal" required className={`${fieldClass} w-24`} placeholder="3.1" />
      </Field>
      <Field label="Date" hint={`Today counts for ${todaySeason}`}>
        <input name="measured_on" type="date" defaultValue={today} max={today} className={`${fieldClass} w-40`} />
      </Field>
      <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
      <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
    </form>
  );
}
