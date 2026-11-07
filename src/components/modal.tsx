"use client";

import { useRef, type ReactNode } from "react";

/**
 * A button that opens a large pop-up (native <dialog>: Esc closes it, focus is
 * trapped, the page behind is inert). The dialog stays open when the page
 * refreshes after a save.
 */
export function Modal({
  title,
  subtitle,
  trigger,
  triggerClassName,
  triggerLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  trigger: ReactNode;
  triggerClassName?: string;
  /** accessible name for the trigger when its content isn't plain text */
  triggerLabel?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        className={triggerClassName}
        onClick={() => dialog.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        // click on the backdrop (outside the panel) closes
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(64rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-navy-600 bg-navy-900 p-0 text-ink shadow-2xl backdrop:bg-navy-950/80 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-navy-700 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-xl font-semibold uppercase tracking-[0.08em] text-neon">{title}</h2>
              {subtitle && <p className="mt-1 font-mono text-xs uppercase tracking-wider text-pink-soft">{subtitle}</p>}
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
          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </div>
      </dialog>
    </>
  );
}
