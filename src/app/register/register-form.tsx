"use client";

import { useActionState, useState } from "react";
import { registerAccount, type RegisterState } from "./actions";

export type SignupTeam = { id: string; name: string; age_group: string | null };

const initial: RegisterState = { error: null, values: { role: "player", name: "", email: "", code: "", child: "", team: "" } };
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

export function RegisterForm({ teams }: { teams: SignupTeam[] }) {
  const [state, action, pending] = useActionState(registerAccount, initial);
  const [role, setRole] = useState<"player" | "parent">(state.values.role);
  const player = role === "player";

  if (state.checkEmail) {
    return (
      <p role="status" className="rounded-lg border border-neon/60 bg-neon/10 p-4 text-sm">
        Almost done. We sent a confirmation link to <strong>{state.values.email}</strong>. Open it on this device, then sign in to
        {player ? " claim your player profile." : " enter your team code."}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">I&apos;m a</legend>
        <div role="radiogroup" className="grid grid-cols-2 rounded-full border border-navy-600 p-0.5">
          {(["player", "parent"] as const).map((r) => (
            <label
              key={r}
              className="cursor-pointer rounded-full px-4 py-1.5 text-center text-sm font-semibold text-muted transition select-none has-checked:bg-pink has-checked:text-on-accent has-focus-visible:ring-2 has-focus-visible:ring-pink/40"
            >
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              {r === "player" ? "Player" : "Parent"}
            </label>
          ))}
        </div>
      </fieldset>

      <Row label={player ? "Your first and last name" : "Your name"}>
        <input name="name" required autoComplete="name" maxLength={80} defaultValue={state.values.name} className={input} />
      </Row>
      {player && (
        <Row label="Your team">
          <select name="team" required defaultValue={state.values.team} className={input}>
            <option value="" disabled>
              {teams.length ? "Pick your team" : "No teams open for sign-up yet"}
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.age_group && !t.name.includes(t.age_group) ? ` · ${t.age_group}` : ""}
              </option>
            ))}
          </select>
        </Row>
      )}
      <Row label="Email">
        <input type="email" name="email" required autoComplete="email" defaultValue={state.values.email} className={input} />
      </Row>
      <Row label="Password" hint="At least 8 characters">
        <input type="password" name="password" required minLength={8} autoComplete="new-password" className={input} />
      </Row>
      <Row label="Confirm password">
        <input type="password" name="confirm" required minLength={8} autoComplete="new-password" className={input} />
      </Row>
      {!player && (
        <>
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
        </>
      )}
      <p aria-live="polite" className="min-h-5 text-sm text-danger">
        {state.error}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neon px-4 py-2 font-semibold text-on-accent transition hover:bg-neon-bright disabled:opacity-60"
      >
        {pending ? "Creating your account…" : player ? "Create player account" : "Create parent account"}
      </button>
    </form>
  );
}
