"use client";

import { useState, useTransition } from "react";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { approveMentor, assignMentorPlayer, removeMentor, removeMentorMessage, setMentorCalendar, unassignMentorPlayer } from "./actions";

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

export function ApproveMentor({ userId, name, specialty }: { userId: string; name: string; specialty: string | null }) {
  const [displayName, setDisplayName] = useState(name);
  const [spec, setSpec] = useState(specialty ?? "");
  const [calendar, setCalendar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => setError((await approveMentor({ userId, displayName, specialty: spec, canSchedule: calendar })).error));
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Name</span>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Coaches</span>
        <input value={spec} onChange={(e) => setSpec(e.target.value)} maxLength={60} placeholder="Pitching" className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={calendar} onChange={(e) => setCalendar(e.target.checked)} className="size-4 accent-pink" />
        Can add dates to her players&apos; weeks
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Approving…" : "Approve"}
      </button>
      <ErrorLine error={error} />
    </form>
  );
}

export function CalendarToggle({ userId, on }: { userId: string; on: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      onClick={() => startTransition(async () => void (await setMentorCalendar({ userId, on: !on })))}
      className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase transition disabled:opacity-50 ${
        on ? "border-neon bg-neon text-on-accent" : "border-navy-500 text-muted hover:border-pink hover:text-ink"
      }`}
    >
      Calendar dates: {on ? "On" : "Off"}
    </button>
  );
}

export function RemoveMentor({ userId, name }: { userId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Remove ${name} as a mentor? She loses access to every player. Messages she sent stay.`))
          startTransition(async () => void (await removeMentor({ userId })));
      }}
      className="text-xs text-muted underline hover:text-danger"
    >
      {pending ? "Removing…" : "Remove mentor"}
    </button>
  );
}

export function AssignPlayer({ mentorId, options }: { mentorId: string; options: { id: string; label: string }[] }) {
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (options.length === 0) return null;
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!playerId) return;
        setError(null);
        startTransition(async () => {
          const res = await assignMentorPlayer({ mentorId, playerId });
          if (res.error) return setError(res.error);
          setPlayerId("");
        });
      }}
    >
      <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} aria-label="Player to assign" className={`${inputClass} py-1.5 text-sm`}>
        <option value="">Assign a player…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending || !playerId} className={secondaryButtonClass}>
        {pending ? "Adding…" : "Assign"}
      </button>
      <ErrorLine error={error} />
    </form>
  );
}

export function UnassignPlayer({ mentorId, playerId, name, canEdit }: { mentorId: string; playerId: string; name: string; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-navy-600 py-0.5 pr-1 pl-3 text-xs font-semibold">
      {name}
      {canEdit && (
        <button
          type="button"
          disabled={pending}
          aria-label={`Unassign ${name}`}
          onClick={() => startTransition(async () => void (await unassignMentorPlayer({ mentorId, playerId })))}
          className="grid size-5 place-items-center rounded-full text-muted hover:bg-navy-800 hover:text-danger"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function RemoveMessage({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Remove this message? The player won't see it any more.")) startTransition(async () => void (await removeMentorMessage({ id })));
      }}
      className="text-xs text-muted underline hover:text-danger"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
