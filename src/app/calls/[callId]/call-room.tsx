"use client";

// The call itself (user, 2026-11-12; docs/features/video-calls.md). Join asks the server for this
// person's join details (only when they may join, only while the call is open), then runs Zoom in
// a frame (public/zoom-call.html) and hands the details over by postMessage, same origin only.
import { useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui";
import { joinVideoCall, type JoinResult } from "../actions";

type Details = Extract<JoinResult, { join: unknown }>["join"];
/**
 * idle → asking (the server checks she may join and signs her in) → connecting (the Zoom frame is up)
 * → in. Leave, or Zoom ending the call, goes to left from any of those; a refusal or a Zoom error
 * goes to error. Join again starts a new attempt: a server reply for an older one is dropped.
 */
type Phase = "idle" | "asking" | "connecting" | "in" | "left" | "error";

export function CallRoom({ callId, host }: { callId: string; host: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  // the join details the frame gets when it says it's ready; the attempt they belong to
  const details = useRef<Details | null>(null);
  const attempt = useRef(0);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as { source?: string; type?: string; detail?: unknown } | null;
      if (data?.source !== "ggg-zoom") return;
      if (data.type === "ready" && details.current) {
        const d = details.current;
        frame.current?.contentWindow?.postMessage(
          { source: "ggg-call", type: "join", signature: d.signature, meetingNumber: d.meetingNumber, password: d.password, userName: d.userName, zak: d.zak },
          window.location.origin,
        );
      } else if (data.type === "joined") {
        setPhase("in");
      } else if (data.type === "ended") {
        details.current = null;
        setPhase("left");
      } else if (data.type === "error") {
        details.current = null;
        setError(typeof data.detail === "string" ? data.detail : "Couldn't join the call.");
        setPhase("error");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function join() {
    const mine = ++attempt.current;
    details.current = null;
    setPhase("asking");
    setError(null);
    let result: JoinResult;
    try {
      result = await joinVideoCall(callId);
    } catch {
      result = { error: "Couldn't reach GGG.Cafe. Check your connection and try again." };
    }
    if (attempt.current !== mine) return; // she left (or tried again) while this was on its way
    if ("error" in result) {
      setError(result.error);
      setPhase("error");
      return;
    }
    details.current = result.join;
    setAppUrl(result.join.appUrl);
    setPhase("connecting");
  }

  function leave() {
    attempt.current++;
    details.current = null;
    setPhase("left");
  }

  const showFrame = phase === "connecting" || phase === "in";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {phase === "asking" || phase === "connecting" || phase === "in" ? (
          <button type="button" onClick={leave} className={buttonStyles("secondary")}>
            Leave the call
          </button>
        ) : (
          <button type="button" onClick={join} className={buttonStyles("primary")}>
            {phase === "left" ? "Join again" : host ? "Start the call" : "Join the call"}
          </button>
        )}
        {appUrl && (
          <a href={appUrl} target="_blank" rel="noreferrer" className="text-sm text-link underline underline-offset-2">
            Open it in the Zoom app instead
          </a>
        )}
      </div>
      <p role="status" className={`text-sm ${phase === "error" ? "text-danger" : "text-muted"}`}>
        {(phase === "asking" || phase === "connecting") && "Connecting… Allow the camera and microphone when your browser asks."}
        {phase === "in" && (host ? "You're the host: let people in from the waiting room." : "You're in. The host lets people in from the waiting room.")}
        {phase === "left" && "You left the call."}
        {phase === "error" && error}
      </p>
      {showFrame && (
        <iframe
          ref={frame}
          src="/zoom-call.html"
          title="Video call"
          allow="camera; microphone; display-capture; autoplay; fullscreen"
          className="h-[70vh] min-h-[26rem] w-full rounded-2xl border border-navy-700 bg-navy-950"
        />
      )}
    </div>
  );
}
