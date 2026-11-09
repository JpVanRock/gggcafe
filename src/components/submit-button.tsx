"use client";

// A form's submit button that shows it is working: while the form's action runs it shows a spinner
// and `pendingLabel`, is disabled (no double saves) and marked aria-busy. Works in any <form> whose
// action is a function (ActionForm, useActionState forms), with no state of your own.
//
//   <ActionForm action={addGame}>
//     ...fields
//     <SubmitButton pendingLabel="Adding…">Add game</SubmitButton>
//   </ActionForm>
//
// In a form with several submit buttons (name/value), only the one that was pressed shows the
// spinner; they are all disabled until the action finishes.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner, buttonStyles, type ButtonVariant } from "@/components/ui";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: ButtonVariant;
  /** what the button says while saving; "Saving…" unless you say otherwise */
  pendingLabel?: ReactNode;
};

export function SubmitButton({ variant = "primary", pendingLabel = "Saving…", className = "", disabled, children, ...rest }: Props) {
  const { pending, data } = useFormStatus();
  const pressed = pending && (rest.name === undefined || data?.get(rest.name) === String(rest.value ?? ""));
  return (
    <button type="submit" {...rest} disabled={disabled || pending} aria-busy={pressed || undefined} className={buttonStyles(variant, className)}>
      {pressed ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
