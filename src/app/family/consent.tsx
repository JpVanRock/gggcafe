"use client";

// Parental consent for a daughter under 13 (COPPA; docs/features/legal.md). Since 2026-11-16 (user: "They
// should be able to click accept to provide consent"; no printed form, no video call) the parent reads
// the notice, ticks the statement and clicks Accept: it's on file at once, and the database keeps their
// sign-in email, the time, and the IP address and browser as the record. Then her login can be made.
// Withdrawing deletes her login right away.
import { useActionState } from "react";
import { Field, buttonClass, groupLabelClass, inputClass } from "@/components/ui";
import { FormMessage } from "@/components/form-message";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { initialFormState } from "@/lib/form";
import { RELATIONSHIPS, RELATIONSHIP_LABEL } from "@/lib/consent";
import { CONSENT_NOTICE, CONSENT_STATEMENT } from "@/lib/legal";
import { acceptParentalConsent, withdrawParentalConsent } from "./actions";

/** The notice, who's giving consent, the statement, and Accept. */
export function ConsentAccept({
  playerId,
  firstName,
  defaultName,
  declinedNote,
}: {
  playerId: string;
  firstName: string;
  defaultName: string;
  /** why an admin declined an earlier signed form (shown so they know) */
  declinedNote: string | null;
}) {
  const [state, action, pending] = useActionState(acceptParentalConsent, initialFormState);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-pink/60 bg-pink/5 p-4">
      <div className="flex flex-col gap-1">
        <p className={`text-pink-soft ${groupLabelClass}`}>Step 1 of 2 · then her login</p>
        <p className="font-semibold">Your consent comes first</p>
        <p className="text-sm text-muted">
          {firstName} is under 13. A federal law (COPPA) requires a parent&apos;s consent before she can sign in. Read the notice, then accept
          it below; you can make her login right after.
        </p>
      </div>
      {declinedNote && (
        <p role="alert" className="rounded-lg border border-danger/60 p-3 text-sm">
          <span className="font-semibold">Your earlier form wasn&apos;t accepted:</span> {declinedNote}
        </p>
      )}
      {/* Phones (user, 2026-11-18, design audit P6): the notice as short sections the parent taps to open, not a
          scroll box inside a card. The words are CONSENT_NOTICE exactly, and what Accept records doesn't change. */}
      <section aria-label="Parental consent notice" className="flex flex-col text-sm sm:hidden">
        {CONSENT_NOTICE.map((n) => (
          <details key={n.heading} className="group border-t border-navy-700 last:border-b">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold select-none [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="inline-block text-link transition group-open:rotate-90">
                ›
              </span>
              {n.heading}
            </summary>
            <p className="pb-3 text-muted">{n.text}</p>
          </details>
        ))}
      </section>
      {/* from 640px up, the whole notice in a box; tabIndex: keyboard users can focus it and scroll with the arrow keys */}
      <section
        aria-label="Parental consent notice"
        tabIndex={0}
        className="hidden max-h-72 flex-col gap-3 overflow-y-auto rounded-lg border border-navy-700 bg-navy-900/60 p-4 text-sm focus-visible:outline-2 focus-visible:outline-pink sm:flex"
      >
        {CONSENT_NOTICE.map((n) => (
          <div key={n.heading}>
            <p className="font-semibold">{n.heading}</p>
            <p className="text-muted">{n.text}</p>
          </div>
        ))}
      </section>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="player_id" value={playerId} />
        <Field label="Your full name">
          <input name="parent_name" required minLength={2} maxLength={120} defaultValue={defaultName} autoComplete="name" className={inputClass} />
        </Field>
        <Field label={`You are ${firstName}'s`}>
          <select name="relationship" required defaultValue="parent" className={inputClass}>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <label htmlFor={`consent-agree-${playerId}`} className="flex items-start gap-2.5 text-sm sm:col-span-2">
          <input id={`consent-agree-${playerId}`} type="checkbox" name="agree" required className="mt-1 size-4 shrink-0 accent-pink" />
          <span>{CONSENT_STATEMENT}</span>
        </label>
        <p className="text-xs text-muted sm:col-span-2">
          We keep a record of your consent: your name, your sign-in email, the time, and the IP address and browser you accept from.
        </p>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Saving…" : "Accept"}
          </button>
          <FormMessage error={state.error} fields={state.fields} />
        </div>
      </form>
    </div>
  );
}

/** Waiting for an admin, or verified: what's on file, and a way to cancel or withdraw it. */
export function ConsentOnFile({
  playerId,
  firstName,
  status,
  method,
  date,
}: {
  playerId: string;
  firstName: string;
  status: "pending" | "verified";
  method: string | null;
  /** submitted (pending) or checked (verified), already formatted */
  date: string;
}) {
  const waiting = status === "pending";
  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-4 ${waiting ? "border-pink/60 bg-pink/5" : "border-navy-700"}`}>
      <p className="font-semibold">{waiting ? "Your consent is being checked" : "Parental consent on file"}</p>
      <p className="text-sm text-muted">
        {waiting
          ? method === "video_call"
            ? `You asked for a video call on ${date}. A GGG.Cafe admin will email you to set it up.`
            : `You sent your signed form on ${date}. GGG.Cafe staff check it, usually within two business days; then you can make ${firstName}'s login here.`
          : `${method === "online" ? "You accepted it" : "Checked"} on ${date}. You can withdraw it at any time: ${firstName}'s login is deleted right away and she can't sign in.`}
      </p>
      <ActionForm action={withdrawParentalConsent} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="player_id" value={playerId} />
        <ConfirmSubmit
          message={
            waiting
              ? "Cancel this consent request? You can send a new one any time."
              : `Withdraw your consent? ${firstName}'s login is deleted right away and she can't sign in. Her information stays until you ask us to delete it.`
          }
          confirmLabel={waiting ? "Cancel request" : "Withdraw consent"}
          className="text-sm font-semibold text-link underline underline-offset-2 hover:text-ink"
        >
          {waiting ? "Cancel this request" : "Withdraw consent"}
        </ConfirmSubmit>
      </ActionForm>
    </div>
  );
}
