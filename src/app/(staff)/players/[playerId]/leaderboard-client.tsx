"use client";

// + Activity (log a session) and the Leaderboard's coach controls (removing a session).
import { useState, useTransition } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { LOG_NOTE_MAX, SESSION_KINDS, sessionLabel, type SessionKind } from "@/lib/leaderboard";
import { deleteSession, logSession, removeTeamSession } from "./leaderboard-actions";

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** + Activity: what kind of session, which day, an optional note. */
export function LogSessionForm({ playerId, today, daysBack }: { playerId: string; today: string; daysBack: number }) {
  const [kind, setKind] = useState<SessionKind | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const yesterday = addDays(today, -1);

  function submit() {
    setError(null);
    setDone(null);
    if (!kind) return setError("Pick what kind of session it was.");
    startTransition(async () => {
      const res = await logSession({ playerId, kind, date, note });
      if (res.error) return setError(res.error);
      setDone(`+${res.points} points · ${sessionLabel(kind)} logged`);
      setKind(null);
      setNote("");
      setDate(today);
    });
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset>
        <legend className="mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">What did you do?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {SESSION_KINDS.map((k) => {
            const on = kind === k.kind;
            return (
              <button
                key={k.kind}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(k.kind)}
                className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition ${
                  on ? "border-neon bg-neon/10" : "border-navy-600 hover:border-pink"
                }`}
              >
                <span className="flex w-full items-baseline justify-between gap-2">
                  <span className="font-display text-lg font-bold tracking-wide uppercase">{k.label}</span>
                  <span className="font-display text-2xl font-bold text-highlight tabular-nums">+{k.points}</span>
                </span>
                <span className="text-sm text-muted">{k.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">When?</legend>
        {[
          { label: "Today", value: today },
          { label: "Yesterday", value: yesterday },
        ].map((d) => (
          <button
            key={d.label}
            type="button"
            aria-pressed={date === d.value}
            onClick={() => setDate(d.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold tracking-wider uppercase transition ${
              date === d.value ? "border-pink bg-pink text-on-accent" : "border-navy-500 text-muted hover:border-pink hover:text-ink"
            }`}
          >
            {d.label}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm text-muted">
          or
          <input
            type="date"
            value={date}
            min={addDays(today, -daysBack)}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            aria-label="Day of the session"
          />
        </label>
      </fieldset>

      <label className="flex max-w-2xl flex-col gap-2">
        <span className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={LOG_NOTE_MAX}
          rows={2}
          placeholder="What you worked on: 100 tee swings, 60-pitch bullpen, lesson with Coach K..."
          className={`${inputClass} w-full`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Logging…" : "Log it"}
        </button>
        {done && <span className="font-display text-lg font-bold text-highlight">{done}</span>}
        <ErrorLine error={error} />
      </div>
    </form>
  );
}

/** Remove one of her logged sessions. */
export function RemoveSession({ playerId, id }: { playerId: string; id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Remove this session? Its points come off the leaderboard.")) return;
          startTransition(async () => setError((await deleteSession({ playerId, id })).error));
        }}
        className="text-xs text-muted underline hover:text-danger"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      <ErrorLine error={error} />
    </>
  );
}

/** Coaches remove a session from the board. */
export function RemoveTeamSession({ id, who }: { id: string; who: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove this session of ${who}'s? Its points come off the leaderboard.`)) return;
          startTransition(async () => setError((await removeTeamSession({ id })).error));
        }}
        className="text-xs text-muted underline hover:text-danger"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      <ErrorLine error={error} />
    </>
  );
}
