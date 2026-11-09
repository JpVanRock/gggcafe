"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { joinTeam } from "./actions";
import { SubmitButton } from "@/components/submit-button";

/** Team code + daughter's name (and her own name the first time). */
export function JoinForm({ askName, defaultName }: { askName: boolean; defaultName: string }) {
  const [state, action] = useActionState(joinTeam, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {askName && (
        <div className="sm:col-span-2">
          <Field label="Your name">
            <input name="name" required maxLength={80} defaultValue={defaultName} autoComplete="name" className={inputClass} />
          </Field>
        </div>
      )}
      <Field label="Team code" hint="Six letters and numbers from your coach">
        <input name="code" required maxLength={10} autoComplete="off" placeholder="ABC-234" className={`${inputClass} font-display tracking-[0.2em] uppercase`} />
      </Field>
      <Field label="Your daughter's name" hint="First and last">
        <input name="child" required maxLength={80} autoComplete="off" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Sending…">Ask to join</SubmitButton>
        <FormMessage error={state.error} fields={state.fields} />
      </div>
    </form>
  );
}
