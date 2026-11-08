"use client";

// A stat's abbreviation that explains itself: tap it to see how it's figured.
import { useEffect, useId, useRef, useState } from "react";
import { STAT_INFO, type StatKey } from "@/lib/stat-formulas";

export function StatTerm({ k, className = "" }: { k: StatKey; className?: string }) {
  const info = STAT_INFO[k];
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        title={`${info.name}: how it's figured`}
        className={`cursor-help underline decoration-dotted decoration-1 underline-offset-2 hover:text-ink ${className}`}
      >
        {info.abbr}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-full left-0 z-30 mt-1.5 block w-64 rounded-xl border border-pink bg-navy-900 p-3 text-left text-xs leading-snug font-normal tracking-normal normal-case shadow-xl"
        >
          <span className="block font-mono text-[10px] font-bold tracking-[0.18em] text-pink-soft uppercase">How it&apos;s figured</span>
          <span className="mt-1 block font-semibold text-ink">{info.name}</span>
          <span className="mt-1 block text-ink/90">{info.formula}</span>
          {"note" in info && info.note && <span className="mt-1 block text-muted">{info.note}</span>}
        </span>
      )}
    </span>
  );
}
