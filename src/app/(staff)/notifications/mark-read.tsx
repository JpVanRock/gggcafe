"use client";

// Opening the notifications page marks them read, so the bell clears. The page
// still shows which ones were new on this visit.
import { useEffect, useRef } from "react";
import { markNotificationsRead } from "./actions";

export function MarkRead({ unread }: { unread: number }) {
  const done = useRef(false);
  useEffect(() => {
    if (unread > 0 && !done.current) {
      done.current = true;
      void markNotificationsRead();
    }
  }, [unread]);
  return null;
}
