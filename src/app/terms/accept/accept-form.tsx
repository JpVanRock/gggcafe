"use client";

import { useActionState } from "react";
import { acceptTerms } from "./actions";
import { signOut } from "@/app/auth/actions";
import { AgreementCheckbox } from "@/components/agreement-checkbox";
import { FormMessage, buttonStyles } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { initialFormState } from "@/lib/form";

export function AcceptForm({ next }: { next: string }) {
  const [state, action] = useActionState(acceptTerms, initialFormState);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <AgreementCheckbox />
        <FormMessage error={state.error} fields={state.fields} />
        <SubmitButton pendingLabel="Saving…" className="w-full">
          Agree and continue
        </SubmitButton>
      </form>
      <form action={signOut} className="text-center">
        <span className="text-sm text-muted">Don&apos;t agree? </span>
        <button type="submit" className={buttonStyles("link")}>
          Sign out
        </button>
      </form>
    </div>
  );
}
