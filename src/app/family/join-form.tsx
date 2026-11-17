"use client";

import { useActionState } from "react";
import { Field, FormMessage, fieldClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { joinTeam, rematchParentLink } from "./actions";
import { SubmitButton } from "@/components/submit-button";

/** Parent code + daughter's name (and their own name the first time). */
export function JoinForm({
  askName,
  defaultName,
  defaultCode = "",
  defaultChild = "",
}: {
  askName: boolean;
  defaultName: string;
  /** from the sign-up page, so she doesn't type them twice */
  defaultCode?: string;
  defaultChild?: string;
}) {
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
      <Field label="Parent code" hint="From her coach, just for parents">
        <input name="code" required maxLength={10} autoComplete="off" defaultValue={defaultCode} placeholder="ABC-234" className={`${inputClass} font-display tracking-[0.2em] uppercase`} />
      </Field>
      <Field label="Your daughter's name" hint="First and last, as it is on the team roster">
        <input name="child" required maxLength={80} autoComplete="off" defaultValue={defaultChild} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Joining…">Join the team</SubmitButton>
        <FormMessage error={state.error} fields={state.fields} />
      </div>
    </form>
  );
}

/** A request that's waiting: her name as it is on the roster, checked again. */
export function FixNameForm({ linkId, defaultChild }: { linkId: string; defaultChild: string }) {
  const [state, action] = useActionState(rematchParentLink, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="link_id" value={linkId} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Her name on the roster" hint="First and last">
          <input name="child" required maxLength={80} autoComplete="off" defaultValue={defaultChild} className={`${fieldClass} w-64`} />
        </Field>
        <SubmitButton pendingLabel="Checking…">Try again</SubmitButton>
      </div>
      <FormMessage error={state.error} fields={state.fields} />
    </form>
  );
}
