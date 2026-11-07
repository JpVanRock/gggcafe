"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { inputClass, pillButtonClass, pillQuietClass } from "@/components/ui";
import type { StaffContact } from "@/lib/practice-plans";
import type { ShareResult } from "../actions";

/**
 * "Finalize & Share": pick which coaches get the plan (all by default), add an
 * optional note, send. The plan is finalized first. Without email set up, the
 * coach's own email app opens with the plan summary and a link instead.
 */
export function ShareButton({
  planId,
  action,
  returnPath,
  staff,
  label,
  className,
  disabled = false,
  emailReady,
  beforeSend,
}: {
  /** the practice plan or lineup to share */
  planId: string;
  /** server action that finalizes and shares it */
  action: (id: string, recipientIds: string[], note: string) => Promise<ShareResult>;
  /** page to show afterwards (gets ?shared=) */
  returnPath: string;
  staff: StaffContact[];
  label: string;
  className: string;
  disabled?: boolean;
  emailReady: boolean;
  /** save pending changes first; false stops the send */
  beforeSend?: () => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(() => staff.map((s) => s.user_id));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  function send() {
    setError(null);
    startTransition(async () => {
      if (beforeSend && !(await beforeSend())) {
        setError("Couldn't save your latest changes. Check your connection and try again.");
        return;
      }
      let result;
      try {
        result = await action(planId, picked, note);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      dialog.current?.close();
      if (result.mailto) {
        window.location.href = result.mailto;
        router.replace(`${returnPath}?shared=app`);
      } else {
        router.replace(`${returnPath}?shared=${result.sent ?? 0}`);
      }
    });
  }

  return (
    <>
      <button type="button" aria-haspopup="dialog" disabled={disabled} className={className} onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-label="Share with coaches"
        onClick={(e) => {
          if (e.target === dialog.current && !pending) dialog.current?.close();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-navy-600 bg-navy-900 p-0 text-ink shadow-2xl backdrop:bg-navy-950/80 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-navy-700 px-5 py-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[0.08em] text-highlight uppercase">Share with coaches</h2>
              <p className="mt-1 font-mono text-xs tracking-wider text-pink-soft uppercase">
                {emailReady ? "Emailed with the PDF attached" : "Opens your email app"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded-md border border-navy-600 px-2.5 py-1 text-sm hover:border-pink hover:bg-navy-800"
              aria-label="Close"
            >
              ✕
            </button>
          </header>
          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
            {staff.length === 0 ? (
              <p className="text-sm text-muted">No coaches with an email on the staff list yet.</p>
            ) : (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Send to</legend>
                <ul className="flex flex-col gap-1.5">
                  {staff.map((s) => (
                    <li key={s.user_id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-navy-700 px-3 py-2 hover:border-pink">
                        <input type="checkbox" checked={picked.includes(s.user_id)} onChange={() => toggle(s.user_id)} className="accent-pink" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{s.display_name}</span>
                          <span className="block truncate text-xs text-muted">{s.email}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Note (optional)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={inputClass} placeholder="Bring the pop-up machine." />
            </label>
            {!emailReady && (
              <p className="text-xs text-muted">
                Automatic email isn&apos;t set up yet, so your email app opens with the plan and a link to it. Hit send there.
              </p>
            )}
            {error && (
              <p aria-live="polite" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={send} disabled={pending || picked.length === 0} className={pillButtonClass}>
                {pending ? "Sending…" : `Finalize & send${picked.length ? ` to ${picked.length}` : ""}`}
              </button>
              <button type="button" onClick={() => dialog.current?.close()} className={pillQuietClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
