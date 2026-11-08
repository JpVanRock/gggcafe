"use client";

// A stat's abbreviation that explains itself: tap it to see how it's figured. The card
// is positioned fixed under the button so a scrolling table can't clip it.
import { useEffect, useId, useRef, useState } from "react";
import { STAT_INFO, type StatKey } from "@/lib/stat-formulas";

export function StatTerm({ k, className = "" }: { k: StatKey; className?: string }) {
  const info = STAT_INFO[k];
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = pos !== null;
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => setPos(null);
  function toggle() {
    if (open || !button.current) return close();
    const r = button.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 264)) });
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={id}
        title={`${info.name}: how it's figured`}
        className={`cursor-help underline decoration-dotted decoration-1 underline-offset-2 hover:text-ink ${className}`}
      >
        {info.abbr}
      </button>
      {pos && (
        <span
          id={id}
          role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left }}
          className="z-50 block w-64 rounded-xl border border-pink bg-navy-900 p-3 text-left text-xs leading-snug font-normal tracking-normal normal-case shadow-xl"
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
