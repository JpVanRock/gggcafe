"use client";

// The Coaches Dugout calendar: a month of team events (practices, workouts,
// lessons, meetings) plus games, Monday to Sunday like TWIS. Coaches and admins
// add, change and remove events; everyone else sees them read-only. Every event
// shows in each player's TWIS for that week.
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field, FormMessage, inputClass, pillButtonClass, pillQuietClass } from "@/components/ui";
import { EVENT_KINDS, EVENT_KIND_LABEL, clockLabel, parseClock, type EventKind } from "@/lib/dugout";
import { initialFormState, type FormState } from "@/lib/form";
import { deleteCalendarEvent, saveCalendarEvent } from "./actions";

export type CalEvent = {
  id: string;
  kind: EventKind;
  title: string | null;
  date: string;
  start: string | null;
  end: string | null;
  location: string | null;
  notes: string | null;
  seriesId: string | null;
  /** "Added by JP" / "Changed by JP" */
  byline: string | null;
  planId: string | null;
};
export type CalGame = { id: string; date: string; start: string | null; label: string; place: string | null };

type Mode =
  | { type: "add"; date: string }
  | { type: "event"; event: CalEvent }
  | { type: "game"; game: CalGame }
  | null;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const longDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
const dayLabel = (iso: string) => longDay.format(new Date(`${iso}T00:00:00Z`));

const time = (t: string | null) => {
  const m = parseClock(t);
  return m === null ? null : clockLabel(m).replace(":00 ", " ");
};
const eventTitle = (e: CalEvent) => e.title || EVENT_KIND_LABEL[e.kind];
const KIND_ACCENT: Record<EventKind, string> = {
  practice: "border-l-neon",
  workout: "border-l-pink",
  lesson: "border-l-pink-soft",
  meeting: "border-l-muted",
  other: "border-l-muted",
};

function EventChip({ event, onOpen }: { event: CalEvent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full truncate rounded border-l-[3px] bg-navy-800 px-1.5 py-0.5 text-left text-xs leading-5 hover:bg-navy-700 ${KIND_ACCENT[event.kind]}`}
      title={eventTitle(event)}
    >
      {time(event.start) && <span className="mr-1 font-display tabular-nums text-muted">{time(event.start)}</span>}
      <span className="font-semibold">{eventTitle(event)}</span>
    </button>
  );
}

function GameChip({ game, onOpen }: { game: CalGame; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full truncate rounded bg-pink px-1.5 py-0.5 text-left text-xs leading-5 font-semibold text-on-accent hover:opacity-90"
      title={`Game ${game.label}`}
    >
      {time(game.start) && <span className="mr-1 font-display tabular-nums">{time(game.start)}</span>}
      {game.label}
    </button>
  );
}

function EventForm({ mode, teamId, onDone }: { mode: { type: "add"; date: string } | { type: "event"; event: CalEvent }; teamId: string; onDone: () => void }) {
  const event = mode.type === "event" ? mode.event : null;
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await saveCalendarEvent(prev, fd);
    if (result.saved) onDone();
    return result;
  }, initialFormState);
  const [delState, deleteAction, deleting] = useActionState(async (prev: FormState, fd: FormData) => {
    const result = await deleteCalendarEvent(prev, fd);
    if (result.saved) onDone();
    return result;
  }, initialFormState);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        {event ? <input type="hidden" name="id" value={event.id} /> : <input type="hidden" name="team_id" value={teamId} />}
        <Field label="Type">
          <select name="kind" defaultValue={event?.kind ?? "practice"} className={inputClass}>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {EVENT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title" hint="Optional, e.g. “Hitting practice”">
          <input name="title" maxLength={120} defaultValue={event?.title ?? ""} className={inputClass} />
        </Field>
        <Field label="Date">
          <input type="date" name="event_date" required defaultValue={event?.date ?? (mode.type === "add" ? mode.date : "")} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <input type="time" name="start_time" step={300} defaultValue={event?.start ?? ""} className={inputClass} />
          </Field>
          <Field label="Ends">
            <input type="time" name="end_time" step={300} defaultValue={event?.end ?? ""} className={inputClass} />
          </Field>
        </div>
        {!event && (
          <Field label="Repeat weekly until" hint="Optional: adds the same event every week">
            <input type="date" name="repeat_until" className={inputClass} />
          </Field>
        )}
        <Field label="Location">
          <input name="location" defaultValue={event?.location ?? ""} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea name="notes" rows={2} defaultValue={event?.notes ?? ""} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={pillButtonClass}>
            {pending ? "Saving…" : event ? "Save changes" : "Add to calendar"}
          </button>
          <FormMessage error={state.error} />
        </div>
      </form>

      {event && (
        <form action={deleteAction} className="flex flex-wrap items-center gap-3 border-t border-navy-700 pt-4">
          <input type="hidden" name="id" value={event.id} />
          {event.seriesId && (
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="sr-only">Which events to remove</legend>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="scope" value="one" defaultChecked className="accent-pink" /> Only this one
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="scope" value="following" className="accent-pink" /> This and later weeks
              </label>
            </fieldset>
          )}
          <button type="submit" disabled={deleting} className="rounded-full border border-danger/60 px-4 py-1.5 text-sm text-danger hover:bg-danger/10">
            {deleting ? "Removing…" : "Remove from calendar"}
          </button>
          <FormMessage error={delState.error} />
        </form>
      )}
    </div>
  );
}

function Details({ rows }: { rows: [string, string | null][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-[8rem_1fr]">
      {rows
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-mono text-[0.75rem] leading-5 font-bold tracking-[0.15em] text-pink-soft uppercase">{label}</dt>
            <dd className="text-sm whitespace-pre-line">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function CalendarView({
  teamId,
  month,
  days,
  today,
  events,
  games,
  canEdit,
}: {
  teamId: string;
  month: string;
  days: string[];
  today: string;
  events: CalEvent[];
  games: CalGame[];
  canEdit: boolean;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (mode && !dialog.current?.open) dialog.current?.showModal();
    if (!mode && dialog.current?.open) dialog.current.close();
  }, [mode]);

  const byDay = (date: string) => ({
    games: games.filter((g) => g.date === date),
    events: events.filter((e) => e.date === date).sort((a, b) => (a.start ?? "99").localeCompare(b.start ?? "99")),
  });
  const inMonth = (d: string) => d.slice(0, 7) === month;

  let title = "";
  let body: React.ReactNode = null;
  if (mode?.type === "add") {
    title = "Add to calendar";
    body = <EventForm key={`add-${mode.date}`} mode={mode} teamId={teamId} onDone={() => setMode(null)} />;
  } else if (mode?.type === "event") {
    const e = mode.event;
    title = eventTitle(e);
    const when = [dayLabel(e.date), [time(e.start), time(e.end)].filter(Boolean).join("–")].filter(Boolean).join(" · ");
    body = canEdit ? (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {when}
          {e.byline && ` · ${e.byline}`}
        </p>
        {e.planId && (
          <Link href={`/dugout/plans/${e.planId}`} className="self-start text-sm font-semibold text-pink hover:underline">
            Open this day&apos;s practice plan →
          </Link>
        )}
        <EventForm key={`edit-${e.id}`} mode={mode} teamId={teamId} onDone={() => setMode(null)} />
      </div>
    ) : (
      <Details
        rows={[
          ["Type", EVENT_KIND_LABEL[e.kind]],
          ["When", when],
          ["Location", e.location],
          ["Notes", e.notes],
          ["Entered", e.byline],
        ]}
      />
    );
  } else if (mode?.type === "game") {
    const g = mode.game;
    title = `Game ${g.label}`;
    body = (
      <div className="flex flex-col gap-4">
        <Details rows={[["When", [dayLabel(g.date), time(g.start)].filter(Boolean).join(" · ")], ["Where", g.place]]} />
        <p className="text-xs text-muted">
          Games are added and changed on the{" "}
          <Link href={`/teams/${teamId}`} className="text-pink hover:underline">
            team page
          </Link>
          .
        </p>
      </div>
    );
  }

  const monthDays = days.filter(inMonth);
  const agenda = monthDays.filter((d) => {
    const { games: g, events: e } = byDay(d);
    return g.length + e.length > 0;
  });

  return (
    <>
      {/* Month grid (tablet and up) */}
      <div className="hidden overflow-hidden rounded-xl border border-navy-700 sm:block">
        <div className="grid grid-cols-7 border-b border-navy-700 bg-navy-900">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-muted uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date, i) => {
            const { games: g, events: e } = byDay(date);
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`group relative min-h-28 border-navy-700 p-1.5 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${
                  inMonth(date) ? "bg-navy-950" : "bg-navy-900/40"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`grid size-6 place-items-center rounded-full font-display text-xs tabular-nums ${
                      isToday ? "bg-pink font-bold text-on-accent" : inMonth(date) ? "text-ink" : "text-muted/60"
                    }`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setMode({ type: "add", date })}
                      aria-label={`Add an event on ${dayLabel(date)}`}
                      className="rounded px-1.5 text-sm leading-5 text-muted opacity-60 transition group-hover:opacity-100 hover:bg-navy-800 hover:text-highlight focus-visible:opacity-100"
                    >
                      +
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {g.map((game) => (
                    <GameChip key={game.id} game={game} onOpen={() => setMode({ type: "game", game })} />
                  ))}
                  {e.map((event) => (
                    <EventChip key={event.id} event={event} onOpen={() => setMode({ type: "event", event })} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day-by-day list (phones) */}
      <div className="flex flex-col gap-3 sm:hidden">
        {canEdit && (
          <button type="button" onClick={() => setMode({ type: "add", date: today.slice(0, 7) === month ? today : `${month}-01` })} className={`${pillButtonClass} self-start`}>
            + Add to calendar
          </button>
        )}
        {agenda.length === 0 ? (
          <p className="rounded-md border border-dashed border-navy-600 p-6 text-center text-sm text-muted">Nothing on the calendar this month.</p>
        ) : (
          agenda.map((date) => {
            const { games: g, events: e } = byDay(date);
            return (
              <section key={date} className="rounded-xl border border-navy-700 bg-navy-900/60 p-3">
                <h3 className={`mb-2 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] uppercase ${date === today ? "text-highlight" : "text-pink-soft"}`}>
                  {dayLabel(date)}
                  {date === today && " · Today"}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {g.map((game) => (
                    <GameChip key={game.id} game={game} onOpen={() => setMode({ type: "game", game })} />
                  ))}
                  {e.map((event) => (
                    <EventChip key={event.id} event={event} onOpen={() => setMode({ type: "event", event })} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      <dialog
        ref={dialog}
        aria-label={title || "Calendar event"}
        onClose={() => setMode(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setMode(null);
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-navy-600 bg-navy-900 p-0 text-ink shadow-2xl backdrop:bg-navy-950/80 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-navy-700 px-5 py-4">
            <h2 className="text-xl font-semibold tracking-[0.08em] text-highlight uppercase">{title}</h2>
            <button type="button" onClick={() => setMode(null)} className={pillQuietClass} aria-label="Close">
              ✕
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-5">{body}</div>
        </div>
      </dialog>
    </>
  );
}
