"use client";

// Verify / Decline for one parental consent (user, 2026-11-18, design audit P8): for a signed form, Verify
// works only once the form has been opened here, so a consent is never confirmed unseen. When the form
// can't be opened, the admin can decline in one tap with a note asking the parent to upload it again.
// Video-call requests have no form: they verify with a note, as before.
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { buttonClass, buttonStyles, inputClass, secondaryButtonClass } from "@/components/ui";
import { reviewParentalConsent } from "./actions";

const REUPLOAD_NOTE = "We couldn't open the signed form. Please upload it again from Logins & Teams.";

export function ConsentReview({ id, playerName, video, url }: { id: string; playerName: string; video: boolean; url?: string }) {
  const [opened, setOpened] = useState(false);
  const canVerify = video || opened;
  const hintId = `verify-hint-${id}`;

  return (
    <>
      {!video &&
        (url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener"
            onClick={() => setOpened(true)}
            className="self-start text-sm font-semibold text-link underline underline-offset-2"
          >
            Open the signed form (link expires in 10 minutes)
          </a>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">The signed form couldn&apos;t be opened. Reload the page, or ask the parent to upload it again.</p>
            <ActionForm action={reviewParentalConsent}>
              <input type="hidden" name="consent_id" value={id} />
              <input type="hidden" name="note" value={REUPLOAD_NOTE} />
              <button type="submit" name="decision" value="decline" aria-label={`Ask to upload again: ${playerName}'s consent form`} className={buttonStyles("secondary")}>
                Ask to upload again
              </button>
            </ActionForm>
          </div>
        ))}
      {!video && (
        <p className="text-xs text-muted">
          Check: it&apos;s our form, signed by hand, the player&apos;s name matches, and the printed name matches the parent account.
        </p>
      )}
      <ActionForm action={reviewParentalConsent} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="consent_id" value={id} />
        <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
          <span className="text-sm font-medium">{video ? "Note (required to verify or decline)" : "Note (required to decline; the parent sees it)"}</span>
          <input name="note" maxLength={500} className={inputClass} />
        </label>
        {/* each named for her, so a list of buttons isn't "Verify, Decline, Verify, Decline" (design audit A7) */}
        <button
          type="submit"
          name="decision"
          value="verify"
          disabled={!canVerify}
          aria-describedby={canVerify ? undefined : hintId}
          aria-label={`Verify ${playerName}`}
          className={buttonClass}
        >
          Verify
        </button>
        <button type="submit" name="decision" value="decline" aria-label={`Decline ${playerName}`} className={secondaryButtonClass}>
          Decline
        </button>
        {!canVerify && (
          <p id={hintId} className="basis-full text-xs text-muted">
            {url ? "Open the signed form first: Verify turns on once you have." : "Verify turns on once the signed form opens."}
          </p>
        )}
      </ActionForm>
    </>
  );
}
