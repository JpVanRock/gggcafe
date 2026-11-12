"use client";

import { useActionState, useState } from "react";
import { registerAccount, type RegisterState } from "./actions";
import { CODE_TYPES, SIGNUP_LABEL, type SignupType } from "@/lib/account-types";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { AgreementCheckbox } from "@/components/agreement-checkbox";

const initial: RegisterState = { error: null, values: { role: "", name: "", email: "", code: "", child: "", specialty: "", org: "", scope: "" } };

// Players and parents first: most sign-ups are theirs.
const MENU: SignupType[] = ["player", "parent", "assistant-coach", "head-coach", "mentor"];

export function RegisterForm() {
  const [state, action] = useActionState(registerAccount, initial);
  const [role, setRole] = useState<SignupType | "">(state.values.role);
  const player = role === "player";
  const parent = role === "parent";
  const assistant = role === "assistant-coach";
  const headCoach = role === "head-coach";
  const mentor = role === "mentor";
  const [scope, setScope] = useState(state.values.scope || "player");
  // a coach who is also a parent on the team (user, 2026-11-12)
  const [alsoParent, setAlsoParent] = useState(Boolean(state.values.child) && (headCoach || assistant));

  if (state.checkEmail) {
    return (
      <p role="status" className="rounded-lg border border-neon/60 bg-neon/10 p-4 text-sm">
        Almost done. We sent a confirmation link to <strong>{state.values.email}</strong>
        {state.team ? ` for ${state.team}` : ""}. Open it on this device, then sign in to
        {player
          ? " claim your player profile."
          : mentor
            ? scope === "team"
              ? " send your request. The head coach approves mentors for the whole team."
              : " send your request. Her parents approve mentors for their daughter."
            : headCoach
              ? " finish. An admin approves new head coaches."
              : assistant
                ? " finish. Your head coach approves assistant coaches."
                : " send your request. Your coach approves parents."}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Account type">
        <select
          name="role"
          required
          defaultValue={state.values.role}
          onChange={(e) => setRole(e.target.value as SignupType)}
          className={inputClass}
        >
          <option value="" disabled>
            Choose your account type
          </option>
          {MENU.map((r) => (
            <option key={r} value={r}>
              {SIGNUP_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>

      {role !== "" && CODE_TYPES.includes(role) && (
        <Field
          label="Team code"
          hint={assistant ? "From your head coach, who approves you" : mentor ? "From the head coach or the player's parents" : "Six letters and numbers from your coach"}
        >
          <input
            name="code"
            required
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={10}
            defaultValue={state.values.code}
            placeholder="ABC-234"
            className={`${inputClass} font-display tracking-[0.2em] uppercase`}
          />
        </Field>
      )}
      <Field label={parent ? "Your name" : "Your first and last name"}>
        <input name="name" required autoComplete="name" maxLength={80} defaultValue={state.values.name} className={inputClass} />
      </Field>
      {parent && (
        <Field label="Your daughter's name" hint="First and last, so your coach can match you to her">
          <input name="child" required autoComplete="off" maxLength={80} defaultValue={state.values.child} className={inputClass} />
        </Field>
      )}
      {headCoach && (
        <Field label="Your team or organization" hint="Helps the admin approve you. You register the team itself after approval.">
          <input name="org" required maxLength={120} autoComplete="organization" defaultValue={state.values.org} className={inputClass} />
        </Field>
      )}
      {(headCoach || assistant) && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={alsoParent} onChange={(e) => setAlsoParent(e.target.checked)} className="mt-0.5 size-4 accent-pink" />
          <span>
            I&apos;m also a parent: my daughter plays on the team
            <span className="block text-xs text-muted">
              Once you&apos;re approved, claim her from your dashboard and switch between your Coach and Parent pages with this one login.
            </span>
          </span>
        </label>
      )}
      {(headCoach || assistant) && alsoParent && (
        <Field label="Your daughter's name" hint="First and last, as she'll be on the roster">
          <input name="child" autoComplete="off" maxLength={80} defaultValue={state.values.child} className={inputClass} />
        </Field>
      )}
      {mentor && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Who you work with</legend>
          {(
            [
              ["player", "One player", "Her parents approve you."],
              ["team", "The whole team", "The head coach approves you."],
            ] as const
          ).map(([value, text, hint]) => (
            <label key={value} className="flex items-start gap-2 text-sm">
              <input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="mt-0.5 size-4 accent-pink" />
              <span>
                {text}
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {mentor && scope === "player" && (
        <Field label="The player's first and last name" hint="As the team has her on the roster">
          <input name="child" required autoComplete="off" maxLength={80} defaultValue={state.values.child} className={inputClass} />
        </Field>
      )}
      {mentor && (
        <Field label="What you coach (optional)" hint="Pitching, hitting, catching, mental game...">
          <input name="specialty" maxLength={60} autoComplete="off" defaultValue={state.values.specialty} className={inputClass} />
        </Field>
      )}
      <Field label="Email">
        <input type="email" name="email" required autoComplete="email" defaultValue={state.values.email} className={inputClass} />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <input type="password" name="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Confirm password">
        <input type="password" name="confirm" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>

      {player && (
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="age13" required className="mt-1 size-4 shrink-0 accent-pink" />
          <span>
            I&apos;m 13 or older. <span className="text-muted">Younger players: a parent makes your login from the family page.</span>
          </span>
        </label>
      )}
      <AgreementCheckbox />

      <FormMessage error={state.error} fields={state.fields} />
      <SubmitButton pendingLabel="Creating your account…" className="w-full">
        {role ? `Create ${SIGNUP_LABEL[role].toLowerCase()} account` : "Create account"}
      </SubmitButton>
    </form>
  );
}
