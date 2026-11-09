"use client";

// The header's menu on phones: the links and the account controls fold behind one "Menu"
// button, so the header is a single row (logo, Night/Day switch, Menu). From 640px up there is
// no button: the panel turns into plain header items (display: contents) and lays out inline.
// The panel closes when a link is tapped or Esc is pressed; Esc puts focus back on the button.
// The Night/Day switch is rendered twice (top row on phones, next to the account from 640px
// up); only one is ever displayed.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { buttonStyles } from "@/components/ui";

export function HeaderMenu({
  nav,
  account,
  toggle,
  count,
}: {
  /** the site links */
  nav: ReactNode;
  /** who is signed in and Sign out */
  account: ReactNode;
  /** the Night/Day switch: stays on the top row on phones */
  toggle: ReactNode;
  /** a CountBadge for the Menu button, so waiting approvals still show while it's closed */
  count?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div
        id={panelId}
        // a tapped link navigates: fold the menu away
        onClick={(e) => {
          if ((e.target as Element).closest("a")) setOpen(false);
        }}
        className={`${open ? "flex" : "hidden"} order-3 basis-full flex-col gap-2 border-t border-navy-700 pt-2 sm:contents`}
      >
        <div className="sm:order-1">{nav}</div>
        {/* from 640px up the switch sits with the account, so the two wrap together like before */}
        <div className="flex items-center justify-between gap-4 border-t border-navy-700 py-3 sm:order-2 sm:ml-auto sm:border-0 sm:py-0">
          <span className="hidden sm:inline-flex">{toggle}</span>
          {account}
        </div>
      </div>
      <div className="order-2 ml-auto flex items-center gap-3 sm:hidden">
        {toggle}
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={buttonStyles("secondary", "min-h-10")}
        >
          <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="m5 5 10 10M15 5 5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
          {open ? "Close" : "Menu"}
          {!open && count}
        </button>
      </div>
    </>
  );
}
