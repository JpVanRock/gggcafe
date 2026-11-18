"use client";

// The header's Account button from 640px up: who is signed in, the Night/Day switch and Sign out sit
// in one panel at the right end, so the header stays a single row (on phones they are in the Menu
// panel instead; header-menu.tsx). Opens on click; Esc or a click outside closes it, and Esc puts
// focus back on the button.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { buttonStyles } from "@/components/ui";

export function AccountMenu({ account, toggle, className = "" }: { account: ReactNode; toggle: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={buttonStyles("secondary")}
      >
        <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="10" cy="7" r="3.2" />
          <path d="M3.8 16.5c1.1-2.8 3.4-4.2 6.2-4.2s5.1 1.4 6.2 4.2" />
        </svg>
        Account
        <svg viewBox="0 0 20 20" aria-hidden className={`size-3.5 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>
      <div
        id={panelId}
        className={`${open ? "flex" : "hidden"} absolute top-full right-0 z-30 mt-2 w-72 flex-col gap-3 rounded-xl border border-navy-700 bg-navy-900 p-4 shadow-xl shadow-black/30`}
      >
        {account}
        <div className="border-t border-navy-700 pt-3">{toggle}</div>
      </div>
    </div>
  );
}
