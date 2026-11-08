"use client";

// Her login (family page): a parent creates a username login for a daughter
// without an email, or sets a new password for one they made.
import { useActionState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { createPlayerLogin, resetPlayerPassword } from "./actions";

function Passwords({ label }: { label: string }) {
  return (
    <>
      <Field label={label} hint="At least 8 characters">
        <input type="password" name="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Confirm password">
        <input type="password" name="confirm" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
    </>
  );
}

export function CreatePlayerLoginForm({ playerId, firstName, suggestion }: { playerId: string; firstName: string; suggestion: string }) {
  const [state, action, pending] = useActionState(createPlayerLogin, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="player_id" value={playerId} />
      <Field label={`${firstName}'s username`} hint="Letters, numbers, dots, dashes; no spaces">
        <input
          name="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,29}"
          defaultValue={suggestion}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={inputClass}
        />
      </Field>
      <Passwords label="Her password" />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Creating…" : `Create ${firstName}'s login`}
        </button>
        <FormMessage error={state.error} />
      </div>
    </form>
  );
}

export function ResetPlayerPasswordForm({ playerId, firstName }: { playerId: string; firstName: string }) {
  const [state, action, pending] = useActionState(resetPlayerPassword, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="player_id" value={playerId} />
      <Passwords label={`${firstName}'s new password`} />
      <div className="flex items-end">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Set new password"}
        </button>
      </div>
      <div className="sm:col-span-3">
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
