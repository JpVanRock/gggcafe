"use client";

// Opening a conversation marks what was written to you as read (user, 2026-11-23). Renders nothing; the action is a
// server action bound to the conversation, and doesn't refresh the page (it already shows the messages).
import { useEffect } from "react";

export function MarkSeen({ action }: { action: () => Promise<unknown> }) {
  useEffect(() => {
    void action();
  }, [action]);
  return null;
}
