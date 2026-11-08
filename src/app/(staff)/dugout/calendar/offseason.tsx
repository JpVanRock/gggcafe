"use client";

// Coaches Dugout → Calendar: the team's Offseason Training dates (the window the
// players' Leaderboard and Player of the Week count). Coaches and admins only.
import { useState, useTransition } from "react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import { setOffseason } from "./actions";

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
