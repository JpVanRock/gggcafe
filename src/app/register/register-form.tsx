"use client";

import { useActionState } from "react";
import { registerParent, type RegisterState } from "./actions";

const initial: RegisterState = { error: null, values: { name: "", email: "", code: "", child: "" } };
const input =
  "rounded-md border border-navy-600 bg-navy-950 px-3 py-2 outline-none focus:border-pink focus:ring-2 focus:ring-pink/30";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerParent, initial);

  if (state.checkEmail) {
    return (
      <p role="status" className="rounded-lg border border-neon/60 bg-neon/10 p-4 text-sm">
        Almost done. We sent a confirmation link to <strong>{state.values.email}</strong>. Open it on this device, then sign in and
        enter your team code.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Row label="Your name">
        <input name="name" required autoComplete="name" maxLength={80} defaultValue={state.values.name} className={input} />
      </Row>
      <Row label="Email">
        <input type="email" name="email" required autoComplete="email" defaultValue={state.values.email} className={input} />
      </Row>
      <Row label="Password" hint="At least 8 characters">
        <input type="password" name="password" required minLength={8} autoComplete="new-password" className={input} />
      </Row>
      <Row label="Confirm password">
        <input type="password" name="confirm" required minLength={8} autoComplete="new-password" className={input} />
      </Row>
      <Row label="Team code" hint="Six letters and numbers from your coach">
        <input
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={10}
          defaultValue={state.values.code}
          placeholder="ABC-234"
          className={`${input} font-display tracking-[0.2em] uppercase`}
        />
      </Row>
      <Row label="Your daughter's name" hint="First and last, so your coach can match you to her">
        <input name="child" required autoComplete="off" maxLength={80} defaultValue={state.values.child} className={input} />
      </Row>
      <p aria-live="polite" className="min-h-5 text-sm text-danger">
        {state.error}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neon px-4 py-2 font-semibold text-on-accent transition hover:bg-neon-bright disabled:opacity-60"
      >
        {pending ? "Creating your account…" : "Create parent account"}
      </button>
    </form>
  );
}
