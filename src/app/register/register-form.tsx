"use client";

import { useActionState, useState } from "react";
import { registerAccount, type RegisterState } from "./actions";
import { SIGNUP_LABEL, type SignupType } from "@/lib/account-types";
import { Field, FormMessage, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { AgreementCheckbox } from "@/components/agreement-checkbox";

const initial: RegisterState = { error: null, values: { role: "", name: "", email: "", child: "", specialty: "", org: "" } };

// Parents first: most sign-ups are theirs. Players don't sign up: a parent makes every player's login
// (user, 2026-11-16).
const MENU: SignupType[] = ["parent", "assistant-coach", "head-coach", "mentor"];

export function RegisterForm() {
  const [state, action] = useActionState(registerAccount, initial);
  const [role, setRole] = useState<SignupType | "">(state.values.role);
  const parent = role === "parent";
  const assistant = role === "assistant-coach";
  const headCoach = role === "head-coach";
  const mentor = role === "mentor";
  // a coach who is also a parent on the team (user, 2026-11-12)
  const [alsoParent, setAlsoParent] = useState(Boolean(state.values.child) && (headCoach || assistant));

  if (state.checkEmail) {
    return (
      <p role="status" className="rounded-lg border border-neon-edge/60 bg-neon/10 p-4 text-sm">
        Almost done. We sent a confirmation link to <strong>{state.values.email}</strong>. Open it on this device, then sign in and
        {mentor
          ? " enter the parent code to ask to work with one player (her parents approve you) or the whole team (the head coach does)."
          : headCoach
            ? " finish. An admin approves new head coaches."
            : assistant
              ? " enter the parent code from your head coach, who approves assistant coaches."
              : " enter the parent code from your coach and your daughter's name. You're in as soon as her name matches the roster."}
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

      <Field label={parent ? "Your name" : "Your first and last name"}>
        <input name="name" required autoComplete="name" maxLength={80} defaultValue={state.values.name} className={inputClass} />
      </Field>
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

      <AgreementCheckbox />

      <FormMessage error={state.error} fields={state.fields} />
      <SubmitButton pendingLabel="Signing you up…" className="w-full">
        {/* one name for this action everywhere: Sign up (design audit C3) */}
        {role ? `Sign up as ${/^[AEIOU]/.test(SIGNUP_LABEL[role]) ? "an" : "a"} ${SIGNUP_LABEL[role].toLowerCase()}` : "Sign up"}
      </SubmitButton>
    </form>
  );
}
