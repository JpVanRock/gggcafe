"use client";

import { useActionState } from "react";
import { FormMessage, inputClass } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form";
import type { Category, Values } from "@/lib/movement";
import { SubmitButton } from "@/components/submit-button";

/**
 * Dropdowns for Movement Preferences (coach wording first) or Preferred
 * Hitting Style (player wording). Saving adds a new version; history stays.
 */
export function StyleForm({
  playerId,
  categories,
  current,
  action,
  coachWords = false,
  submitLabel,
}: {
  playerId: string;
  categories: Category[];
  current: Values;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  coachWords?: boolean;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="player_id" value={playerId} />
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((c) => (
          <label key={c.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {c.title}
              {coachWords && <span className="ml-1.5 text-xs font-normal text-muted">({c.coach})</span>}
            </span>
            <select name={c.key} defaultValue={current[c.key] ?? ""} className={inputClass}>
              <option value="">Not set</option>
              {c.choices.map((o) => (
                <option key={o.value} value={o.value}>
                  {coachWords ? `${o.coach} · ${o.label}` : o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        {state.saved && !state.error ? (
          <p aria-live="polite" className="text-sm text-highlight">
            Saved. Earlier answers stay in the history.
          </p>
        ) : (
          <FormMessage error={state.error} fields={state.fields} />
        )}
      </div>
    </form>
  );
}
