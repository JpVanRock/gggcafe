"use client";

// A conversation's messages in a box of their own, kept scrolled to the newest (user, 2026-11-23: "like a chat").
// It follows new messages unless you scrolled up to read; screen readers hear new messages (role="log").
// Keyboard users can scroll it: it takes focus.
import { useEffect, useRef, type ReactNode } from "react";

export function ChatScroll({ count, label, className = "", children }: { count: number; label: string; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef(0);
  const atEnd = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (seen.current === 0 || (count > seen.current && atEnd.current)) el.scrollTop = el.scrollHeight;
    seen.current = count;
  }, [count]);
  return (
    <div
      ref={box}
      role="log"
      aria-label={label}
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      }}
      className={`relative overflow-y-auto overscroll-contain rounded-xl focus-visible:outline-2 focus-visible:outline-pink ${className}`}
    >
      {children}
    </div>
  );
}
