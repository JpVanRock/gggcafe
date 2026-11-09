"use client";

// A form whose server action reports back: it shows the action's error (no permission,
// a stale page, a database error) right after the form's own controls. While the action runs
// the form is aria-busy and its submit buttons dim and can't be pressed again (globals.css);
// use <SubmitButton> inside it for a spinner and "Saving…".
import { useActionState, type FormHTMLAttributes, type ReactNode } from "react";
import { initialFormState, type FormState } from "@/lib/form";

export function ActionForm({
  action,
  children,
  ...rest
}: { action: (prev: FormState, fd: FormData) => Promise<FormState>; children: ReactNode } & Omit<FormHTMLAttributes<HTMLFormElement>, "action">) {
  const [state, dispatch, pending] = useActionState(action, initialFormState);
  return (
    <form action={dispatch} aria-busy={pending} {...rest}>
      {children}
      {state.error && (
        <span role="alert" className="basis-full text-xs text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
