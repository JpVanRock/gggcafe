"use client";

// A guided mental session: a breathing pacer (the circle grows on the breath in and
// shrinks on the breath out) or an imagery script that moves step by step. At the
// end she logs it; if it's one of her routines today, it's checked off in TWIS.
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { buttonClass, secondaryButtonClass, eyebrowClass } from "@/components/ui";
import type { GuidedSession } from "@/lib/mental";
import { finishGuidedSession } from "./mental-actions";

type Segment = { kind: "in" | "hold" | "out" | "see"; label: string; seconds: number; round: number };

function timeline(session: GuidedSession): Segment[] {
  if (session.pattern) {
    const p = session.pattern;
    const out: Segment[] = [];
    for (let r = 1; r <= p.rounds; r++) {
      out.push({ kind: "in", label: "Breathe in", seconds: p.inhale, round: r });
      if (p.hold) out.push({ kind: "hold", label: "Hold", seconds: p.hold, round: r });
      out.push({ kind: "out", label: "Breathe out", seconds: p.exhale, round: r });
      if (p.holdOut) out.push({ kind: "hold", label: "Hold", seconds: p.holdOut, round: r });
    }
    return out;
  }
  return (session.steps ?? []).map((s, i) => ({ kind: "see", label: s.text, seconds: s.seconds, round: i + 1 }));
}

export function SessionRunner({ playerId, session, canEdit, backHref }: { playerId: string; session: GuidedSession; canEdit: boolean; backHref: string }) {
  const segments = useMemo(() => timeline(session), [session]);
  const [started, setStarted] = useState(false);
  // where the pacer is: one state object, so every tick is a single pure update
  const [pos, setPos] = useState({ index: 0, left: segments[0]?.seconds ?? 0, done: false });
  const [paused, setPaused] = useState(false);
  const [logged, setLogged] = useState<null | { checked: boolean }>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const stage = !started ? "intro" : pos.done ? "done" : "run";
  const index = pos.index;
  const left = pos.left;
  const seg = segments[index];
  const breathing = session.kind === "breathing";
  const rounds = breathing ? session.pattern!.rounds : segments.length;

  useEffect(() => {
    if (stage !== "run" || paused) return;
    const t = setInterval(
      () =>
        setPos((p) => {
          if (p.left > 1) return { ...p, left: p.left - 1 };
          if (p.index + 1 >= segments.length) return { ...p, left: 0, done: true };
          return { index: p.index + 1, left: segments[p.index + 1].seconds, done: false };
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [stage, paused, segments]);

  function start() {
    setPos({ index: 0, left: segments[0].seconds, done: false });
    setPaused(false);
    setLogged(null);
    setStarted(true);
  }

  function jump(to: number) {
    if (to < 0) return;
    if (to >= segments.length) return setPos((p) => ({ ...p, done: true }));
    setPos({ index: to, left: segments[to].seconds, done: false });
  }

  function log() {
    setError(null);
    startTransition(async () => {
      const res = await finishGuidedSession({ playerId, slug: session.slug });
      if (res.error) return setError(res.error);
      setLogged({ checked: res.checked });
    });
  }

  const label = `${session.kind === "breathing" ? "Breathing" : "Imagery"} · about ${session.minutes} min`;

  if (stage === "intro") {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <p className={eyebrowClass}>{label}</p>
        {session.intro.map((p, i) => (
          <p key={i} className="text-lg text-ink/90">
            {p}
          </p>
        ))}
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" onClick={start} className={buttonClass}>
            Start
          </button>
          <Link href={backHref} className={secondaryButtonClass}>
            Back to Mental GP
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <p className="font-display text-3xl font-bold tracking-wide text-highlight uppercase">Done</p>
        <p className="text-lg text-ink/90">{session.close}</p>
        {canEdit && !logged && (
          <div>
            <button type="button" disabled={pending} onClick={log} className={buttonClass}>
              {pending ? "Saving…" : "Log it"}
            </button>
          </div>
        )}
        {logged && (
          <p role="status" className="rounded-xl border border-neon/60 bg-neon/10 p-4 text-sm">
            {logged.checked
              ? "Checked off in TWIS. It counts toward your training streaks and achievements."
              : "Nice work. Make it a mental routine in Performance Training to check it off in TWIS."}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={start} className={secondaryButtonClass}>
            Again
          </button>
          <Link href={backHref} className={secondaryButtonClass}>
            Back to Mental GP
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className={eyebrowClass}>
        {breathing ? `Round ${seg.round} of ${rounds}` : `${seg.round} of ${rounds}`}
      </p>
      {breathing ? (
        <div className="relative grid size-64 place-items-center sm:size-72" aria-live="polite">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-linear-to-br from-pink/40 to-neon/40 shadow-[0_0_60px_rgba(254,31,124,0.35)] ease-in-out motion-reduce:transition-none"
            style={{
              transform: `scale(${seg.kind === "in" ? 1 : seg.kind === "out" ? 0.5 : segments[index - 1]?.kind === "in" ? 1 : 0.5})`,
              transitionProperty: "transform",
              transitionDuration: `${seg.kind === "hold" ? 0 : seg.seconds}s`,
            }}
          />
          <span className="relative text-center">
            <span className="block font-display text-3xl font-bold tracking-wide text-ink uppercase">{seg.label}</span>
            <span className="block font-display text-5xl font-black text-highlight tabular-nums">{left}</span>
          </span>
        </div>
      ) : (
        <div className="flex w-full max-w-2xl flex-col gap-4" aria-live="polite">
          <p className="min-h-32 text-2xl leading-snug font-semibold text-ink">{seg.label}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-navy-800" aria-hidden>
            <div className="h-full bg-linear-to-r from-pink to-neon transition-all duration-1000 ease-linear" style={{ width: `${((seg.seconds - left) / seg.seconds) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {!breathing && (
          <button type="button" onClick={() => jump(index - 1)} disabled={index === 0} className={secondaryButtonClass}>
            ← Back
          </button>
        )}
        <button type="button" onClick={() => setPaused((p) => !p)} className={secondaryButtonClass}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={() => jump(breathing ? segments.length : index + 1)} className={secondaryButtonClass}>
          {breathing ? "Finish" : "Next →"}
        </button>
      </div>
    </div>
  );
}
