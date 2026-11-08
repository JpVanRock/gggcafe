"use client";

// Coaches Dugout → Calendar: the team's Offseason Training dates (the window the
// players' Leaderboard and Player of the Week count). Coaches and admins only.
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import { setOffseason } from "./actions";

const HIDDEN_KEY = "ggg-offseason-panel-hidden";

/**
 * The Offseason Training panel above the month, with a Hide / Show toggle. Hidden,
 * it's one line with the dates. Each coach's choice is remembered in this browser
 * (localStorage; if storage is blocked it just starts shown).
 */
export function OffseasonPanel({ status, children }: { status: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount: localStorage isn't there during server render
      setHidden(window.localStorage.getItem(HIDDEN_KEY) === "1");
    } catch {}
  }, []);
  function toggle() {
    const next = !hidden;
    setHidden(next);
    try {
      if (next) window.localStorage.setItem(HIDDEN_KEY, "1");
      else window.localStorage.removeItem(HIDDEN_KEY);
    } catch {}
  }
  return (
    <section
      aria-label="Offseason Training"
      className={`flex flex-col gap-3 rounded-2xl border border-neon/50 bg-neon/5 ${hidden ? "px-4 py-2.5 sm:px-5" : "p-4 sm:p-5"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Offseason Training</h3>
        {hidden && <span className="min-w-0 flex-1 truncate text-sm text-muted">{status}</span>}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!hidden}
          className="rounded-full border border-navy-500 px-3 py-0.5 text-xs font-semibold tracking-wider text-muted uppercase transition hover:border-pink hover:text-ink"
        >
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
      {!hidden && (
        <>
          <p className="-mt-2 text-sm">{status}</p>
          {children}
        </>
      )}
    </section>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

/** Coaches set the offseason dates for a team. */
export function OffseasonForm({ teamId, startsOn, endsOn }: { teamId: string; startsOn: string | null; endsOn: string | null }) {
  const [start, setStart] = useState(startsOn ?? "");
  const [end, setEnd] = useState(endsOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const save = (s: string, e: string) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setOffseason({ teamId, startsOn: s, endsOn: e });
      if (res.error) return setError(res.error);
      setSaved(true);
    });
  };
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save(start, end);
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Offseason starts</span>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Ends (optional)</span>
        <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {pending ? "Saving…" : "Save dates"}
      </button>
      {startsOn && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Turn off the offseason leaderboard for this team? Points and Players of the Week are kept.")) save("", "");
          }}
          className="text-xs text-muted underline hover:text-danger"
        >
          Turn off
        </button>
      )}
      {saved && <span className="text-xs text-muted">Saved</span>}
      <ErrorLine error={error} />
    </form>
  );
}
