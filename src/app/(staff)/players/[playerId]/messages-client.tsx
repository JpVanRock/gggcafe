"use client";

import { useTransition } from "react";
import { markMessagesRead } from "./messages-actions";

/** "Got it": she's read it (or all of them). */
export function GotIt({ playerId, ids, label = "Got it" }: { playerId: string; ids: string[]; label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await markMessagesRead({ playerId, ids })))}
      className="rounded-full border border-neon px-3 py-1 text-xs font-semibold tracking-wider text-highlight uppercase transition hover:bg-neon hover:text-on-accent disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}
