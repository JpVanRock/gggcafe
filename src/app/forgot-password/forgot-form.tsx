"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { requestPasswordReset, type ResetRequestState } from "./actions";

const initialState: ResetRequestState = { sent: false, error: null, email: "" };

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  const expired = useSearchParams().get("expired") === "1";

  if (state.sent) {
    return (
      <div className="rounded-md border border-neon/60 bg-neon/10 p-4 text-sm" role="status">
        <p className="font-semibold text-highlight">Check your email.</p>
        <p className="mt-1 text-ink/90">
          If {state.email} has a GGG.Cafe account, a reset link is on its way. Open it in this browser within the hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {expired && (
        <p className="rounded-md border border-pink/60 bg-pink/10 p-3 text-sm" role="alert">
          That reset link has expired or was already used. Request a new one below.
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        {/* text, not email: a username gets a clear answer (her parent resets it) */}
        <input
          type="text"
          inputMode="email"
          name="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.email}
          className="rounded-md border border-navy-600 bg-navy-950 px-3 py-2 outline-none focus:border-pink focus:ring-2 focus:ring-pink/30"
        />
      </label>

      <p aria-live="polite" className="min-h-5 text-sm text-danger">
        {state.error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neon px-4 py-2 font-semibold text-on-accent transition hover:bg-neon-bright disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a reset link"}
      </button>
    </form>
  );
}
