"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { WEEKDAYS } from "@/lib/dates";
import { initialFormState } from "@/lib/form";
import { addActivity, setTwisCheck } from "./twis-actions";
import type { PracticeNote, TwisItem } from "./data";

export type TwisCellView = {
  key: string;
  label: string;
  sublabel: string;
  isToday: boolean;
  isRestDay: boolean;
  items: TwisItem[];
  /** the coach's practice notes that day, with her own cue */
  notes?: PracticeNote[];
};

function PracticeNotes({ notes, many }: { notes: PracticeNote[]; many: boolean }) {
  return (
    <div className="mt-3 space-y-2">
      {notes.map((n, i) => (
        <div key={i} className="rounded-lg border-l-2 border-pink bg-navy-900/60 px-2.5 py-2 text-xs leading-snug">
          <p className="font-mono text-[10px] font-bold tracking-wider text-pink-soft uppercase">Practice plan{many ? ` · ${n.team}` : ""}</p>
          {n.objective && <p className="mt-1 text-ink">{n.objective}</p>}
          {n.rule && (
            <p className="mt-1 text-muted">
              <span className="font-semibold text-ink/90">Rule of the day:</span> {n.rule}
            </p>
          )}
          {n.cue && (
            <p className="mt-1">
              <span className="font-semibold text-highlight">Your cue:</span> {n.cue}
            </p>
          )}
          {n.announcements && <p className="mt-1 whitespace-pre-line text-muted">{n.announcements}</p>}
        </div>
      ))}
    </div>
  );
}

const TAG_CLASS: Record<TwisItem["kind"], string> = {
  game: "bg-neon text-on-accent",
  event: "bg-pink text-on-accent",
  activity: "border border-navy-600 text-muted",
};

export function TwisChecklist({ playerId, cells, canEdit }: { playerId: string; cells: TwisCellView[]; canEdit: boolean }) {
  const saved = new Set(cells.flatMap((c) => c.items.filter((i) => i.checked).map((i) => i.key)));
  const [checked, setChecked] = useOptimistic(saved, (state: Set<string>, change: { key: string; on: boolean }) => {
    const next = new Set(state);
    if (change.on) next.add(change.key);
    else next.delete(change.key);
    return next;
  });
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const items = cells.flatMap((c) => c.items);
  const done = items.filter((i) => checked.has(i.key)).length;

  function toggle(item: TwisItem, on: boolean) {
    startTransition(async () => {
      setChecked({ key: item.key, on });
      const result = await setTwisCheck({ playerId, kind: item.kind, refId: item.refId, onDate: item.onDate, checked: on });
      setError(result.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-800" aria-hidden>
          <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
        <p className="font-mono text-sm tabular-nums text-highlight" aria-live="polite">
          {done}/{items.length} done
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cells.map((cell) => (
          <section
            key={cell.key}
            aria-label={`${cell.label} ${cell.sublabel}`}
            className={`rounded-xl border p-3 ${cell.isToday ? "border-pink bg-pink/10" : "border-navy-700 bg-navy-950/40"}`}
          >
            <header className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs font-bold tracking-widest text-highlight uppercase">{cell.label}</span>
              <span className="font-mono text-xs text-muted">{cell.isToday ? "Today" : cell.sublabel}</span>
            </header>
            {cell.items.length === 0 && !cell.notes?.length ? (
              <p className="mt-3 text-sm text-muted/70">{cell.isRestDay ? "Rest day" : "Nothing extra this week"}</p>
            ) : cell.items.length === 0 ? null : (
              <ul className="mt-3 space-y-2.5">
                {cell.items.map((item) => {
                  const on = checked.has(item.key);
                  return (
                    <li key={item.key}>
                      <label className={`flex items-start gap-2.5 ${canEdit ? "cursor-pointer" : ""}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5 size-5 shrink-0 accent-pink"
                          checked={on}
                          disabled={!canEdit}
                          onChange={(e) => toggle(item, e.target.checked)}
                        />
                        <span className="min-w-0">
                          <span className={`block text-sm leading-snug font-medium ${on ? "text-muted line-through decoration-pink decoration-2" : ""}`}>
                            {item.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            <span className={`rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider uppercase ${TAG_CLASS[item.kind]}`}>
                              {item.tag}
                            </span>
                            {item.detail}
                            {item.link && (
                              <Link href={item.link.href} className="font-semibold text-pink-soft hover:underline">
                                {item.link.label} →
                              </Link>
                            )}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {cell.notes && cell.notes.length > 0 && <PracticeNotes notes={cell.notes} many={new Set(cell.notes.map((n) => n.team)).size > 1} />}
          </section>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ActivityForm({
  playerId,
  defaultStart,
  pillars,
}: {
  playerId: string;
  defaultStart: string;
  pillars: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(addActivity, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="player_id" value={playerId} />
      <Field label="Activity">
        <input name="title" required placeholder="Tee work, long toss, wall ball…" className={inputClass} />
      </Field>
      <Field label="Supports goal area" hint="From the Harada chart (optional)">
        <select name="pillar_id" defaultValue="" className={inputClass}>
          <option value="">—</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Which days?</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {WEEKDAYS.map((d) => (
            <label key={d.n} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="days" value={d.n} className="size-4 accent-pink" />
              {d.short}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">Leave all unticked for “once a week, any day”.</p>
      </fieldset>

      <Field label="Starts">
        <input type="date" name="starts_on" defaultValue={defaultStart} className={inputClass} />
      </Field>
      <Field label="Ends" hint="Leave blank to keep it going">
        <input type="date" name="ends_on" className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="this_week_only" className="size-4 accent-pink" />
        Just this week
      </label>
      <div className="sm:col-span-2">
        <Field label="Details">
          <input name="details" placeholder="3 sets of 15, focus on the high tee" className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add to TWIS"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
