"use client";

import { useActionState } from "react";
import { setNewPassword, type NewPasswordState } from "./actions";

const initialState: NewPasswordState = { error: null };
const inputClass =
  "rounded-md border border-navy-600 bg-navy-950 px-3 py-2 outline-none focus:border-pink focus:ring-2 focus:ring-pink/30";

export function ResetForm({ email }: { email: string | null }) {
  const [state, formAction, pending] = useActionState(setNewPassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {email && (
        <p className="text-center text-sm text-muted">
          For <span className="text-ink">{email}</span>
        </p>
      )}
      {/* lets password managers attach the new password to the right account */}
      <input type="email" name="username" autoComplete="username" defaultValue={email ?? ""} hidden readOnly />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">New password</span>
        <input type="password" name="password" autoComplete="new-password" minLength={8} required className={inputClass} />
        <span className="text-xs text-muted">At least 8 characters.</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Type it again</span>
        <input type="password" name="confirm" autoComplete="new-password" minLength={8} required className={inputClass} />
      </label>

      <p aria-live="polite" className="min-h-5 text-sm text-danger">
        {state.error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neon px-4 py-2 font-semibold text-navy-950 transition hover:bg-neon-bright disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
