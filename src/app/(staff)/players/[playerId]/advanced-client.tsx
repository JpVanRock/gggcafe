"use client";

// G3 Advanced, the parts she interacts with. These get one chapter's content as
// props from the server page; never import src/lib/advanced-book.ts here (paid
// content stays on the server). Type-only imports are fine.
import { useState, useTransition } from "react";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import type { Habit } from "@/lib/advanced-book";
import {
  renameAdvancedBook, saveAdvancedMine, saveAdvancedNotes, setAdvancedAccess, setAdvancedChapterDone, setAdvancedHabit, setConfirmedPosition,
} from "./advanced-actions";

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mt-2 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

/** Her book's title, renamable. */
export function BookTitle({ playerId, title, canEdit, maxLength }: { playerId: string; title: string; canEdit: boolean; maxLength: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!editing) {
    return canEdit ? (
      <button
        type="button"
        onClick={() => {
          setValue(title);
          setEditing(true);
        }}
        className="text-sm text-pink hover:underline"
      >
        Rename your book
      </button>
    ) : null;
  }
  return (
    <form
      className="flex w-full max-w-md flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await renameAdvancedBook({ playerId, title: value });
          if (res.error) return setError(res.error);
          setEditing(false);
        });
      }}
    >
      <label className="text-sm font-semibold" htmlFor="book-title">
        Your book&apos;s title
      </label>
      <input id="book-title" value={value} onChange={(e) => setValue(e.target.value)} maxLength={maxLength} className={inputClass} autoFocus />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
      <ErrorLine error={error} />
    </form>
  );
}

/** The chapter's foundation: she marks the habits she owns. */
export function FoundationHabits({
  playerId,
  chapter,
  habits,
  owned: initial,
  canEdit,
}: {
  playerId: string;
  chapter: string;
  habits: Habit[];
  owned: string[];
  canEdit: boolean;
}) {
  const [owned, setOwned] = useState(new Set(initial));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  function toggle(key: string) {
    const on = !owned.has(key);
    const next = new Set(owned);
    if (on) next.add(key);
    else next.delete(key);
    setOwned(next);
    setError(null);
    startTransition(async () => {
      const res = await setAdvancedHabit({ playerId, chapter, habit: key, owned: on });
      if (res.error) {
        setError(res.error);
        setOwned(owned);
      }
    });
  }
  return (
    <div>
      <p className="mb-3 font-mono text-[11px] tracking-wider text-muted uppercase">
        {owned.size} of {habits.length} owned
      </p>
      <ol className="grid gap-3">
        {habits.map((h, i) => {
          const on = owned.has(h.key);
          return (
            <li key={h.key} className={`flex items-start gap-4 rounded-xl border p-4 transition ${on ? "border-neon/70 bg-neon/5" : "border-navy-600"}`}>
              <span className="font-display text-2xl font-bold text-highlight tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{h.text}</p>
                {h.detail && <p className="mt-1 text-sm text-muted">{h.detail}</p>}
              </div>
              <button
                type="button"
                aria-pressed={on}
                disabled={!canEdit}
                onClick={() => toggle(h.key)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase transition disabled:opacity-50 ${
                  on ? "border-neon bg-neon text-on-accent" : "border-navy-500 text-muted hover:border-pink hover:text-ink"
                }`}
              >
                {on ? "I own this ✓" : "I own this"}
              </button>
            </li>
          );
        })}
      </ol>
      <ErrorLine error={error} />
    </div>
  );
}

/** The habits she adds on top of the foundation. */
export function MyHabits({
  playerId,
  chapter,
  mine: initial,
  canEdit,
  max,
  maxLength,
}: {
  playerId: string;
  chapter: string;
  mine: string[];
  canEdit: boolean;
  max: number;
  maxLength: number;
}) {
  const [mine, setMine] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function save(next: string[]) {
    const before = mine;
    setMine(next);
    setError(null);
    startTransition(async () => {
      const res = await saveAdvancedMine({ playerId, chapter, mine: next });
      if (res.error) {
        setError(res.error);
        setMine(before);
      } else if (res.mine) setMine(res.mine);
    });
  }
  return (
    <div>
      {mine.length > 0 ? (
        <ul className="grid gap-2">
          {mine.map((h, i) => (
            <li key={`${i}-${h}`} className="flex items-start gap-3 rounded-lg border border-pink/40 bg-pink/5 px-3 py-2.5">
              <span className="mt-0.5 font-mono text-[11px] tracking-wider text-pink-soft uppercase">Mine</span>
              <span className="min-w-0 flex-1 text-sm">{h}</span>
              {canEdit && (
                <button type="button" onClick={() => save(mine.filter((_, k) => k !== i))} className="text-xs text-muted hover:text-danger" aria-label={`Remove: ${h}`}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No habits of your own yet. What else do you do (or want to do) to compete here?</p>
      )}
      {canEdit && mine.length < max && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) save([...mine, draft]);
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={maxLength}
            placeholder="Add a habit of your own"
            aria-label="Add a habit of your own"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button type="submit" disabled={pending || !draft.trim()} className={secondaryButtonClass}>
            Add
          </button>
        </form>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

export function ChapterNotes({ playerId, chapter, notes, canEdit, maxLength }: { playerId: string; chapter: string; notes: string | null; canEdit: boolean; maxLength: number }) {
  const [value, setValue] = useState(notes ?? "");
  const [saved, setSaved] = useState(notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== saved.trim();
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!canEdit}
        maxLength={maxLength}
        rows={5}
        aria-label="My notes"
        placeholder="What works for you, what you noticed, what you're working on."
        className={inputClass}
      />
      {canEdit && (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await saveAdvancedNotes({ playerId, chapter, notes: value });
                if (res.error) return setError(res.error);
                setSaved(value);
              });
            }}
            className={secondaryButtonClass}
          >
            {pending ? "Saving…" : "Save notes"}
          </button>
          {!dirty && saved && <span className="text-xs text-muted">Saved</span>}
        </div>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

export function ChapterDone({
  playerId,
  chapter,
  done,
  canEdit,
  locked,
}: {
  playerId: string;
  chapter: string;
  done: boolean;
  canEdit: boolean;
  /** why it can't be completed yet (e.g. the course isn't finished) */
  locked?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!canEdit && !done) return null;
  if (!done && locked) return <p className="text-sm text-muted">{locked}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {done ? (
        <>
          <span className="rounded-full border border-neon bg-neon/10 px-3 py-1 text-sm font-semibold text-highlight">Chapter complete ✓</span>
          {canEdit && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => setError((await setAdvancedChapterDone({ playerId, chapter, done: false })).error))}
              className="text-xs text-muted underline hover:text-ink"
            >
              Reopen
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setError((await setAdvancedChapterDone({ playerId, chapter, done: true })).error))}
          className={buttonClass}
        >
          {pending ? "Saving…" : "Mark chapter complete"}
        </button>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

/** Admins only: turn G3 Advanced on or off for a player. */
export function AdvancedAccessToggle({ playerId, name, on }: { playerId: string; name: string; on: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (on && !window.confirm(`Turn off G3 Advanced for ${name}? Her book is kept and comes back if you turn it on again.`)) return;
          setError(null);
          startTransition(async () => setError((await setAdvancedAccess({ playerId, on: !on })).error));
        }}
        className={on ? "text-xs text-muted underline hover:text-danger" : buttonClass}
      >
        {pending ? "Saving…" : on ? "Turn off G3 Advanced" : `Unlock G3 Advanced for ${name}`}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/** Coaches: confirm a player at a position (opens that position's chapter in her book). */
export function ConfirmPosition({
  playerId,
  name,
  position,
  label,
  confirmed,
}: {
  playerId: string;
  name: string;
  position: string;
  label: string;
  confirmed: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {confirmed && <span className="rounded-full border border-neon bg-neon/10 px-3 py-1 text-sm font-semibold text-highlight">Confirmed {label} ✓</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmed && !window.confirm(`Remove ${name} as a confirmed ${label}? Her ${label} chapter leaves her book (her notes are kept).`)) return;
          setError(null);
          startTransition(async () => setError((await setConfirmedPosition({ playerId, position, on: !confirmed })).error));
        }}
        className={confirmed ? "text-xs text-muted underline hover:text-danger" : secondaryButtonClass}
      >
        {pending ? "Saving…" : confirmed ? "Remove" : `Confirm ${name} as a ${label}`}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}
