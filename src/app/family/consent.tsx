"use client";

// Verified parental consent for a daughter under 13 (COPPA; docs/features/legal.md): download the
// form, sign it by hand, upload a photo or scan; or ask for a short video call. A GGG.Cafe admin
// checks it, then her login can be made. Withdrawing deletes her login right away.
import { useActionState, useState } from "react";
import { Disclosure, Field, buttonClass, inputClass } from "@/components/ui";
import { FormMessage } from "@/components/form-message";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { createClient } from "@/lib/supabase/client";
import { initialFormState } from "@/lib/form";
import { CONSENT_BUCKET, CONSENT_MAX_BYTES, RELATIONSHIPS, RELATIONSHIP_LABEL, consentFormPath } from "@/lib/consent";
import { CONSENT_STATEMENT } from "@/lib/legal";
import { submitParentalConsent, withdrawParentalConsent } from "./actions";

const MAX_SIDE = 2000; // px: enough to read a handwritten signature

/** Shrinks a phone photo of the signed page to a JPEG (PDFs and small files go up as they are). */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image."))), "image/jpeg", 0.88),
  );
}

function WhoFields({ firstName, defaultName, idPrefix }: { firstName: string; defaultName: string; idPrefix: string }) {
  return (
    <>
      <Field label="Your full name" hint="As you signed it">
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
      <label htmlFor={`${idPrefix}-agree`} className="flex items-start gap-2.5 text-sm sm:col-span-2">
        <input id={`${idPrefix}-agree`} type="checkbox" name="agree" required className="mt-1 size-4 shrink-0 accent-pink" />
        <span>{CONSENT_STATEMENT}</span>
      </label>
    </>
  );
}

/** Steps 1–3: the form, the upload, the details; or a video call. */
export function ConsentSteps({
  playerId,
  firstName,
  userId,
  defaultName,
  declinedNote,
}: {
  playerId: string;
  firstName: string;
  userId: string;
  defaultName: string;
  /** why an admin declined the last one (shown so she can fix it and send again) */
  declinedNote: string | null;
}) {
  const [state, action, pending] = useActionState(submitParentalConsent, initialFormState);
  const [video, videoAction, videoPending] = useActionState(submitParentalConsent, initialFormState);
  const [upload, setUpload] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    setUploadError(null);
    if (!file) return;
    const isPdf = file.type === "application/pdf";
    if (!isPdf && !file.type.startsWith("image/")) return setUploadError("Upload a photo (JPG, PNG or a phone photo) or a PDF scan.");
    setUploading(true);
    try {
      const blob = isPdf ? file : await shrink(file);
      const type = isPdf ? "application/pdf" : "image/jpeg";
      if (blob.size > CONSENT_MAX_BYTES) return setUploadError("That file is over 10 MB. Try a photo instead.");
      const path = consentFormPath(userId, Date.now(), type);
      if (!path) return setUploadError("Upload a photo or a PDF scan.");
      const { error } = await createClient().storage.from(CONSENT_BUCKET).upload(path, blob, { contentType: type });
      if (error) return setUploadError("The upload didn't go through. Try again.");
      setUpload({ path, name: file.name });
    } catch {
      setUploadError("Couldn't read that file. Try a different photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-pink/60 bg-pink/5 p-4">
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Your consent comes first</p>
        <p className="text-sm text-muted">
          {firstName} is under 13. A federal law (COPPA) requires a parent&apos;s verified consent before she can sign in. It takes a few
          minutes; GGG.Cafe staff check it, usually within two business days.
        </p>
      </div>
      {declinedNote && (
        <p role="alert" className="rounded-lg border border-danger/60 p-3 text-sm">
          <span className="font-semibold">Your last one wasn&apos;t accepted:</span> {declinedNote}
        </p>
      )}
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>
          <a href={`/family/consent/${playerId}/pdf`} target="_blank" rel="noopener" className="font-semibold text-link underline underline-offset-2">
            Download the consent form (PDF)
          </a>{" "}
          and print it.
        </li>
        <li>Sign it by hand.</li>
        <li>Upload a clear photo or scan of the whole page, then send it below.</li>
      </ol>

      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="player_id" value={playerId} />
        <input type="hidden" name="method" value="signed_form" />
        <input type="hidden" name="form_path" value={upload?.path ?? ""} />
        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={`consent-file-${playerId}`} className="text-sm font-medium">
            Signed form
          </label>
          <input
            id={`consent-file-${playerId}`}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => pick(e.target.files?.[0])}
            disabled={uploading}
            className="w-full max-w-full min-w-0 text-sm file:mr-3 file:rounded-full file:border file:border-navy-600 file:bg-navy-800 file:px-4 file:py-1.5 file:text-sm file:text-ink"
          />
          <p aria-live="polite" className={`text-xs ${uploadError ? "text-danger" : "text-muted"}`}>
            {uploadError ?? (uploading ? "Uploading…" : upload ? `Uploaded: ${upload.name}` : "A phone photo is fine. Only you and GGG.Cafe staff can see it.")}
          </p>
        </div>
        <WhoFields firstName={firstName} defaultName={defaultName} idPrefix={`form-${playerId}`} />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending || uploading || !upload} className={buttonClass}>
            {pending ? "Sending…" : "Send for verification"}
          </button>
          <FormMessage error={state.error} fields={state.fields} />
        </div>
      </form>

      <Disclosure summary="Can't print it? Ask for a video call instead">
        <form action={videoAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="player_id" value={playerId} />
          <input type="hidden" name="method" value="video_call" />
          <p className="text-sm text-muted sm:col-span-2">
            A GGG.Cafe admin emails you to set up a short video call. Have a photo ID ready to show; we don&apos;t keep a copy of it.
          </p>
          <WhoFields firstName={firstName} defaultName={defaultName} idPrefix={`video-${playerId}`} />
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={videoPending} className={buttonClass}>
              {videoPending ? "Sending…" : "Ask for a video call"}
            </button>
            <FormMessage error={video.error} fields={video.fields} />
          </div>
        </form>
      </Disclosure>
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
      <p className="font-semibold">{waiting ? "Your consent is being checked" : "Parental consent verified"}</p>
      <p className="text-sm text-muted">
        {waiting
          ? method === "video_call"
            ? `You asked for a video call on ${date}. A GGG.Cafe admin will email you to set it up.`
            : `You sent your signed form on ${date}. GGG.Cafe staff check it, usually within two business days; then you can make ${firstName}'s login here.`
          : `Checked on ${date}. You can withdraw it at any time: ${firstName}'s login is deleted right away and she can't sign in.`}
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
