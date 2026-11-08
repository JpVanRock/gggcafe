"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null, email: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email or username</span>
        <input
          type="text"
          name="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.email}
          className="rounded-md border border-navy-600 bg-navy-950 px-3 py-2 outline-none focus:border-pink focus:ring-2 focus:ring-pink/30"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
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
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
