"use client";

// A form whose server action reports back: it shows the action's error (no permission,
// a stale page, a database error) right after the form's own controls.
import { useActionState, type FormHTMLAttributes, type ReactNode } from "react";
import { initialFormState, type FormState } from "@/lib/form";

export function ActionForm({
  action,
  children,
  ...rest
}: { action: (prev: FormState, fd: FormData) => Promise<FormState>; children: ReactNode } & Omit<FormHTMLAttributes<HTMLFormElement>, "action">) {
  const [state, dispatch] = useActionState(action, initialFormState);
  return (
    <form action={dispatch} {...rest}>
      {children}
      {state.error && (
        <span role="alert" className="basis-full text-xs text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
