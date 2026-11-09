"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { claimSpot, type ClaimState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

const initial: ClaimState = { error: null };

export function ClaimForm({ teamId, defaultName, defaultJersey }: { teamId: string; defaultName: string; defaultJersey?: string | null }) {
  const [state, action] = useActionState(claimSpot, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_8rem]">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="Your first and last name">
        <input name="name" required maxLength={80} defaultValue={defaultName} autoComplete="name" className={inputClass} />
      </Field>
      <Field label="Jersey #">
        <input name="jersey" required inputMode="numeric" maxLength={3} defaultValue={defaultJersey ?? ""} placeholder="7" className={`${inputClass} font-display tabular-nums`} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Sending…">Claim my profile</SubmitButton>
        <FormMessage error={state.error} fields={state.fields} />
      </div>
    </form>
  );
}
