"use client";

import { useActionState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { saveMentalPlan } from "./actions";
import { MENTAL_FIELDS, type MentalPlan } from "./shared";

export function MentalForm({ playerId, plan }: { playerId: string; plan: MentalPlan | null }) {
  const [state, action, pending] = useActionState(saveMentalPlan, initialFormState);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="player_id" value={playerId} />
      {MENTAL_FIELDS.map((f) => (
        <div key={f.name} className={f.name === "focus_words" || f.name === "notes" ? "md:col-span-2" : ""}>
          <Field label={f.label} hint={f.hint}>
            {f.name === "focus_words" ? (
              <input name={f.name} defaultValue={plan?.[f.name] ?? ""} placeholder="Breathe. See it. Drive it." className={inputClass} />
            ) : (
              <textarea name={f.name} rows={3} defaultValue={plan?.[f.name] ?? ""} className={inputClass} />
            )}
          </Field>
        </div>
      ))}
      <div className="flex items-center gap-4 md:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save Mental GP"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
