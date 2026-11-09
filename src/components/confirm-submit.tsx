"use client";

// "Are you sure?" in the site's own look instead of the browser's grey alert box (which on a phone
// also prints the site's address over the question). Built on <dialog>: focus moves into it and
// starts on Cancel (the safe answer), Esc or a click outside cancels, and focus goes back to the
// button that asked.
//
//   A submit button that asks first (in any form, ActionForm included):
//     <ConfirmSubmit message="Delete this game? Its box score goes too." className={…}>Delete</ConfirmSubmit>
//
//   Asking from your own code, instead of window.confirm (tests/unit/ui-rules.test.ts bans that):
//     onClick={async () => {
//       if (!(await confirmAction("Remove this message? The player won't see it any more."))) return;
//       startTransition(…);
//     }}
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { buttonStyles } from "@/components/ui";

type Options = {
  /** the yes button; defaults to "Yes" */
  confirmLabel?: string;
  /** "danger" (red yes button) for deletes, removals and turning things off, the default; "primary" otherwise */
  tone?: "danger" | "primary";
};

function ConfirmDialog({ message, confirmLabel = "Yes", tone = "danger", onAnswer }: Options & { message: ReactNode; onAnswer: (yes: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const textId = useId();
  const answered = useRef(false);
  const answer = useCallback(
    (yes: boolean) => {
      if (answered.current) return;
      answered.current = true;
      ref.current?.close();
      onAnswer(yes);
    },
    [onAnswer],
  );
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label="Please confirm"
      aria-describedby={textId}
      onCancel={() => answer(false)}
      onClick={(e) => e.target === ref.current && answer(false)}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-navy-600 bg-navy-900 p-0 text-ink shadow-2xl backdrop:bg-navy-950/80 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-6">
        <p id={textId} className="text-base">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {/* autoFocus: Cancel is the safe default for Enter */}
          <button type="button" autoFocus onClick={() => answer(false)} className={buttonStyles("secondary", "px-4 py-2")}>
            Cancel
          </button>
          <button type="button" onClick={() => answer(true)} className={buttonStyles(tone === "danger" ? "danger" : "primary", "px-4 py-2")}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Asks `message` in a dialog; resolves true for yes, false for Cancel, Esc or a click outside. */
export function confirmAction(message: ReactNode, options: Options = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      <ConfirmDialog
        message={message}
        {...options}
        onAnswer={(yes) => {
          resolve(yes);
          // after this click finishes: unmount the dialog and put focus back where it was
          setTimeout(() => {
            root.unmount();
            host.remove();
            opener?.focus();
          });
        }}
      />,
    );
  });
}

/** A submit button that asks first; on yes it submits its form. The yes button repeats a short label ("Delete"). */
export function ConfirmSubmit({
  message,
  className,
  children,
  confirmLabel,
  tone,
}: {
  message: string;
  className?: string;
  children: ReactNode;
} & Options) {
  const button = useRef<HTMLButtonElement>(null);
  const label = confirmLabel ?? (typeof children === "string" && children.trim().length <= 24 ? children.trim() : "Yes");
  return (
    <button
      ref={button}
      type="button"
      aria-haspopup="dialog"
      className={className}
      onClick={async () => {
        if (await confirmAction(message, { confirmLabel: label, tone })) button.current?.form?.requestSubmit();
      }}
    >
      {children}
    </button>
  );
}
