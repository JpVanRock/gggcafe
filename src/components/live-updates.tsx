"use client";

// Live conversations (user, 2026-11-23: "players do not have email so is there a way to have a ongoing dialogue like
// a chat"): while a conversation is on screen, a new message (or "Seen") re-renders the page from the server.
// Supabase Realtime tells us a row changed (it checks the viewer's read rules first); we don't use the row itself,
// the page reloads what it shows. If the live connection drops, the page still checks every 30 seconds while
// it's visible, and again when you come back to the tab. The Supabase browser client loads only here, after the
// page is up (it's about 220 KB).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/lazy-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLL_MS = 30_000;

export function LiveUpdates({ table, column, value }: { table: "mentor_messages" | "video_call_messages"; column: string; value: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!UUID.test(value) || !/^[a-z_]+$/.test(column)) return;
    let stopped = false;
    let pending: ReturnType<typeof setTimeout> | null = null;
    // several changes at once (a message and its "Seen") make one refresh
    const refresh = () => {
      if (stopped || pending) return;
      pending = setTimeout(() => {
        pending = null;
        if (!stopped) router.refresh();
      }, 400);
    };
    let unsubscribe: (() => void) | null = null;
    void (async () => {
      try {
        const supabase = await browserClient();
        if (stopped) return;
        const channel = supabase
          .channel(`${table}:${column}:${value}:${Math.random().toString(36).slice(2)}`)
          .on("postgres_changes", { event: "*", schema: "public", table, filter: `${column}=eq.${value}` }, refresh)
          .subscribe();
        unsubscribe = () => void supabase.removeChannel(channel);
        if (stopped) unsubscribe();
      } catch {
        // no live connection: the 30-second check below still runs
      }
    })();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (pending) clearTimeout(pending);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe?.();
    };
  }, [table, column, value, router]);
  return null;
}
