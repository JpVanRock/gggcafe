"use client";

// G3 Leadership Guide, the parts she interacts with. Content comes in as props from
// the server pages; never import src/lib/leadership-guide.ts values here (paid
// content stays on the server). Type-only imports are fine.
import { useState, useTransition } from "react";
import { buttonClass, inputClass, secondaryButtonClass, eyebrowClass } from "@/components/ui";
import type { HabitItem, LeadershipPlan, RubricArea } from "@/lib/leadership-guide";
import {
  commitLeadershipPlan, saveCoachRating, saveLeadershipAnswer, saveLeadershipPlan, setLeadershipAccess, setLeadershipLessonDone,
  setLeadershipStep, signLeadershipPlan,
} from "./leadership-actions";
import { confirmAction } from "@/components/confirm-submit";

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mt-2 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

function chip(on: boolean) {
  return `rounded-full border px-3 py-1 text-xs font-semibold tracking-wider uppercase transition disabled:opacity-50 ${
    on ? "border-neon bg-neon text-on-accent" : "border-navy-500 text-muted hover:border-pink hover:text-ink"
  }`;
}

/** A written answer that saves when she taps Save. */
export function AnswerBox({
  playerId,
  lesson,
  answerKey,
  label,
  initial,
  canEdit,
  maxLength,
  rows = 3,
}: {
  playerId: string;
  lesson: string;
  answerKey: string;
  label: string;
  initial: string;
  canEdit: boolean;
  maxLength: number;
  rows?: number;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== saved.trim();
  return (
    <div>
      <label className="block font-semibold" htmlFor={`${lesson}-${answerKey}`}>
        {label}
      </label>
      <textarea
        id={`${lesson}-${answerKey}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!canEdit}
        maxLength={maxLength}
        rows={rows}
        className={`${inputClass} mt-2 w-full`}
      />
      {canEdit && (
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await saveLeadershipAnswer({ playerId, lesson, key: answerKey, value });
                if (res.error) return setError(res.error);
                setSaved(value);
              });
            }}
            className={secondaryButtonClass}
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {!dirty && saved.trim() && <span className="text-xs text-muted">Saved</span>}
        </div>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

/** "Try this": steps she checks off. */
export function StepChecks({
  playerId,
  lesson,
  steps,
  done: initial,
  canEdit,
}: {
  playerId: string;
  lesson: string;
  steps: { key: string; text: string }[];
  done: string[];
  canEdit: boolean;
}) {
  const [done, setDone] = useState(new Set(initial));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  return (
    <div>
      <ul className="grid gap-2">
        {steps.map((s) => {
          const on = done.has(s.key);
          return (
            <li key={s.key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={!canEdit}
                onClick={() => {
                  const next = new Set(done);
                  if (on) next.delete(s.key);
                  else next.add(s.key);
                  const before = done;
                  setDone(next);
                  setError(null);
                  startTransition(async () => {
                    const res = await setLeadershipStep({ playerId, lesson, step: s.key, done: !on });
                    if (res.error) {
                      setError(res.error);
                      setDone(before);
                    }
                  });
                }}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${
                  on ? "border-neon/70 bg-neon/5" : "border-navy-600 hover:border-pink"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border text-xs font-bold ${
                    on ? "border-neon bg-neon text-on-accent" : "border-navy-500"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className={on ? "text-ink" : "text-ink/90"}>{s.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <ErrorLine error={error} />
    </div>
  );
}

export function LessonDone({ playerId, lesson, done, canEdit }: { playerId: string; lesson: string; done: boolean; canEdit: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!canEdit && !done) return null;
  const set = (value: boolean) => startTransition(async () => setError((await setLeadershipLessonDone({ playerId, lesson, done: value })).error));
  return (
    <div className="flex flex-wrap items-center gap-3">
      {done ? (
        <>
          <span className="rounded-full border border-neon bg-neon/10 px-3 py-1 text-sm font-semibold text-highlight">Lesson complete ✓</span>
          {canEdit && (
            <button type="button" disabled={pending} onClick={() => set(false)} className="text-xs text-muted underline hover:text-ink">
              Reopen
            </button>
          )}
        </>
      ) : (
        <button type="button" disabled={pending} onClick={() => set(true)} className={buttonClass}>
          {pending ? "Saving…" : "Mark lesson complete"}
        </button>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

/** Habits of Great Leaders: each habit is a strength or something she's working on. */
export function HabitsTool({
  playerId,
  lesson,
  habits,
  answers,
  canEdit,
}: {
  playerId: string;
  lesson: string;
  habits: HabitItem[];
  answers: Record<string, string>;
  canEdit: boolean;
}) {
  const [marks, setMarks] = useState<Record<string, string>>(answers);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  function mark(key: string, value: string) {
    const next = marks[key] === value ? "" : value;
    const before = marks;
    setMarks({ ...marks, [key]: next });
    setError(null);
    startTransition(async () => {
      const res = await saveLeadershipAnswer({ playerId, lesson, key, value: next });
      if (res.error) {
        setError(res.error);
        setMarks(before);
      }
    });
  }
  const strengths = habits.filter((h) => marks[h.key] === "strength").length;
  const growth = habits.filter((h) => marks[h.key] === "growth").length;
  const groups = [...new Set(habits.map((h) => h.group))];
  return (
    <div>
      <p className="mb-3 font-mono text-2xs tracking-wider text-muted uppercase">
        {strengths} strengths · {growth} working on it · {habits.length - strengths - growth} to go
      </p>
      <div className="grid gap-5">
        {groups.map((g) => (
          <div key={g}>
            <h3 className="mb-2 text-sm font-semibold text-highlight">{g}</h3>
            <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
              {habits
                .filter((h) => h.group === g)
                .map((h) => (
                  <li key={h.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 text-sm">{h.text}</span>
                    <span className="flex gap-2">
                      <button type="button" aria-pressed={marks[h.key] === "strength"} disabled={!canEdit} onClick={() => mark(h.key, "strength")} className={chip(marks[h.key] === "strength")}>
                        Strength
                      </button>
                      <button type="button" aria-pressed={marks[h.key] === "growth"} disabled={!canEdit} onClick={() => mark(h.key, "growth")} className={chip(marks[h.key] === "growth")}>
                        Working on it
                      </button>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

/**
 * Rate Your Leadership: she rates herself in each area (1 to the number of levels);
 * her coach can too. With showCoach off it's her own scale only (All In's levels).
 */
export function RubricTool({
  playerId,
  lesson,
  areas,
  levels,
  self: initialSelf,
  coach: initialCoach,
  canEdit,
  canRate,
  showCoach = true,
}: {
  playerId: string;
  lesson: string;
  areas: RubricArea[];
  levels: readonly string[];
  self: Record<string, string>;
  coach: Record<string, string>;
  canEdit: boolean;
  canRate: boolean;
  showCoach?: boolean;
}) {
  const [self, setSelf] = useState(initialSelf);
  const [coach, setCoach] = useState(initialCoach);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  function rate(who: "self" | "coach", key: string, n: string) {
    const current = who === "self" ? self : coach;
    const value = current[key] === n ? "" : n;
    if (who === "self") setSelf({ ...self, [key]: value });
    else setCoach({ ...coach, [key]: value });
    setError(null);
    startTransition(async () => {
      const res = who === "self" ? await saveLeadershipAnswer({ playerId, lesson, key, value }) : await saveCoachRating({ playerId, key, value });
      if (res.error) setError(res.error);
    });
  }
  const scale = (who: "self" | "coach", key: string, enabled: boolean) => (
    <span className="flex gap-1.5" role="group" aria-label={who === "self" ? "My rating" : "Coach's rating"}>
      {levels.map((_, i) => String(i + 1)).map((n) => {
        const on = (who === "self" ? self : coach)[key] === n;
        return (
          <button
            key={n}
            type="button"
            aria-pressed={on}
            aria-label={`${n}: ${levels[Number(n) - 1]}`}
            title={levels[Number(n) - 1]}
            disabled={!enabled}
            onClick={() => rate(who, key, n)}
            className={`grid size-8 place-items-center rounded-full border font-display text-sm font-bold transition disabled:opacity-60 ${
              on ? (who === "self" ? "border-neon bg-neon text-on-accent" : "border-pink bg-pink text-on-accent") : "border-navy-500 text-muted hover:border-pink"
            }`}
          >
            {n}
          </button>
        );
      })}
    </span>
  );
  const groups = [...new Set(areas.map((a) => a.group ?? ""))];
  const total = (ratings: Record<string, string>) => areas.reduce((sum, a) => sum + Number(ratings[a.key] || 0), 0);
  return (
    <div>
      <p className="mb-3 font-mono text-2xs tracking-wider text-muted uppercase">
        {levels.map((l, i) => `${i + 1} ${l}`).join(" · ")}
      </p>
      <div className="grid gap-6">
        {groups.map((g) => (
          <div key={g}>
            {g && <h3 className="mb-2 text-sm font-semibold text-highlight">{g}</h3>}
            <ul className="grid gap-3">
              {areas
                .filter((a) => (a.group ?? "") === g)
                .map((a) => (
                  <li key={a.key} className="rounded-xl border border-navy-700 p-4">
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-sm text-muted">{a.looks}</p>
                    <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                      <div>
                        {showCoach && <p className={`${eyebrowClass} mb-1.5`}>Me</p>}
                        {scale("self", a.key, canEdit)}
                      </div>
                      {showCoach && (
                        <div>
                          <p className={`${eyebrowClass} mb-1.5`}>My coach</p>
                          {canRate || coach[a.key] ? scale("coach", a.key, canRate) : <span className="text-xs text-muted">Not rated yet</span>}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      {showCoach && (
        <p className="mt-4 font-display text-sm tabular-nums text-muted">
          Me {total(self)} / {areas.length * levels.length} · My coach {total(coach)} / {areas.length * levels.length}
        </p>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

/** My Leadership Plan. */
export function PlanForm({
  playerId,
  plan: initial,
  committedAt,
  commitment,
  canEdit,
  limits,
}: {
  playerId: string;
  plan: LeadershipPlan;
  committedAt: string | null;
  commitment: string[];
  canEdit: boolean;
  limits: { text: number; habits: number; goals: number; steps: number; checkIns: number };
}) {
  const filled: Required<LeadershipPlan> = {
    why: initial.why ?? "",
    habits: Array.from({ length: limits.habits }, (_, i) => initial.habits?.[i] ?? ""),
    goals: Array.from({ length: limits.goals }, (_, i) => ({
      goal: initial.goals?.[i]?.goal ?? "",
      steps: Array.from({ length: limits.steps }, (_, k) => initial.goals?.[i]?.steps?.[k] ?? ""),
    })),
    checkIns: Array.from({ length: limits.checkIns }, (_, i) => initial.checkIns?.[i] ?? ""),
    reflection: initial.reflection ?? "",
  };
  const [plan, setPlan] = useState(filled);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const field = inputClass;
  const heading = "mb-2 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

  function save(commit = false) {
    setError(null);
    startTransition(async () => {
      const res = commit ? await commitLeadershipPlan({ playerId, plan }) : await saveLeadershipPlan({ playerId, plan });
      if (res.error) return setError(res.error);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    });
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <fieldset disabled={!canEdit} className="flex flex-col gap-8">
        <section>
          <h2 className={heading}>1 · Why I lead</h2>
          <textarea
            value={plan.why}
            onChange={(e) => setPlan({ ...plan, why: e.target.value })}
            maxLength={limits.text}
            rows={3}
            aria-label="Why I lead"
            placeholder="Why do you want to lead, and why will you be good at it?"
            className={field}
          />
        </section>
        <section>
          <h2 className={heading}>2 · My three leadership habits</h2>
          <div className="grid gap-2">
            {plan.habits.map((h, i) => (
              <input
                key={i}
                value={h}
                onChange={(e) => setPlan({ ...plan, habits: plan.habits.map((x, k) => (k === i ? e.target.value : x)) })}
                maxLength={200}
                aria-label={`Habit ${i + 1}`}
                placeholder={`Habit ${i + 1}: something small I'll do every day`}
                className={field}
              />
            ))}
          </div>
        </section>
        <section>
          <h2 className={heading}>3 · My goals this season</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {plan.goals.map((g, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border border-navy-700 p-4">
                <textarea
                  value={g.goal}
                  onChange={(e) => setPlan({ ...plan, goals: plan.goals.map((x, k) => (k === i ? { ...x, goal: e.target.value } : x)) })}
                  maxLength={limits.text}
                  rows={2}
                  aria-label={`Goal ${i + 1}`}
                  placeholder={`Goal ${i + 1}: specific, measurable, done by a date`}
                  className={field}
                />
                {g.steps.map((s, k) => (
                  <input
                    key={k}
                    value={s}
                    onChange={(e) =>
                      setPlan({
                        ...plan,
                        goals: plan.goals.map((x, gi) => (gi === i ? { ...x, steps: x.steps.map((y, si) => (si === k ? e.target.value : y)) } : x)),
                      })
                    }
                    maxLength={300}
                    aria-label={`Goal ${i + 1}, action step ${k + 1}`}
                    placeholder={`Action step ${k + 1}`}
                    className={field}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className={heading}>4 · Check-ins with my coach</h2>
          <p className="mb-3 text-sm text-muted">
            Save your plan and each date shows up in your This Week in Softball. Your coach gets a reminder too.
          </p>
          <div className="flex flex-wrap gap-3">
            {plan.checkIns.map((d, i) => (
              <label key={i} className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Check-in {i + 1}</span>
                <input
                  type="date"
                  value={d}
                  onChange={(e) => setPlan({ ...plan, checkIns: plan.checkIns.map((x, k) => (k === i ? e.target.value : x)) })}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </section>
        <section>
          <h2 className={heading}>5 · How it&apos;s going</h2>
          <textarea
            value={plan.reflection}
            onChange={(e) => setPlan({ ...plan, reflection: e.target.value })}
            maxLength={limits.text}
            rows={4}
            aria-label="How it's going"
            placeholder="Come back to this all season: what's working, what's in the way, what you'll change."
            className={field}
          />
        </section>
      </fieldset>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={secondaryButtonClass}>
            {pending ? "Saving…" : "Save my plan"}
          </button>
          {savedAt && <span className="text-xs text-muted">Saved {savedAt}</span>}
        </div>
      )}

      <section className="rounded-2xl border-2 border-pink bg-navy-950/60 p-5">
        <h2 className={heading}>My commitment</h2>
        <ul className="grid gap-1.5">
          {commitment.map((c) => (
            <li key={c} className="flex gap-2 text-sm">
              <span className="text-link">·</span>
              {c}
            </li>
          ))}
        </ul>
        {committedAt ? (
          <p className="mt-4 font-semibold text-highlight">Committed ✓</p>
        ) : (
          canEdit && (
            <button type="button" disabled={pending} onClick={() => save(true)} className={`${buttonClass} mt-4`}>
              I commit to my plan
            </button>
          )
        )}
      </section>
      <ErrorLine error={error} />
    </form>
  );
}

/**
 * Coaches sign off a finished course, which awards her Certificate of Leadership and
 * the Leader Badge. `ready`: every core lesson complete and her plan committed.
 */
export function CoachSignOff({
  playerId,
  name,
  signed,
  ready,
  canManage,
}: {
  playerId: string;
  name: string;
  signed: boolean;
  ready: boolean;
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!canManage)
    return signed ? (
      <p className="font-semibold text-highlight">Signed off by your coach ✓</p>
    ) : (
      <p className="text-sm text-muted">
        {ready ? "Waiting on your coach's sign-off." : "Finish every lesson and commit to your plan, then your coach signs off."}
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-3">
      {signed && <span className="rounded-full border border-neon bg-neon/10 px-3 py-1 text-sm font-semibold text-highlight">Signed off · certificate awarded ✓</span>}
      {!signed && !ready && <span className="text-sm text-muted">{name} needs every lesson complete and her plan committed first.</span>}
      {(signed || ready) && (
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            if (signed && !(await confirmAction(`Take back the sign-off? ${name} loses her certificate and Leader Badge until you sign again.`))) return;
            setError(null);
            startTransition(async () => setError((await signLeadershipPlan({ playerId, signed: !signed })).error));
          }}
          className={signed ? "text-xs text-muted underline hover:text-danger" : buttonClass}
        >
          {pending ? "Saving…" : signed ? "Take back sign-off" : "Sign off & award the certificate"}
        </button>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

/** Coaches and admins: pick a player to train as a leader. */
export function LeaderToggle({ playerId, name, on }: { playerId: string; name: string; on: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {on && <span className="rounded-full border border-neon bg-neon/10 px-3 py-1 text-sm font-semibold text-highlight">Training as a leader ✓</span>}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (on && !(await confirmAction(`Stop training ${name} as a leader? The Leadership Guide leaves her book (her work is kept).`))) return;
          setError(null);
          startTransition(async () => setError((await setLeadershipAccess({ playerId, on: !on })).error));
        }}
        className={on ? "text-xs text-muted underline hover:text-danger" : secondaryButtonClass}
      >
        {pending ? "Saving…" : on ? "Remove" : `Train ${name} as a leader`}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/** Prints the Certificate of Leadership (globals.css prints only the sheet). */
export function PrintCertificateButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass}>
      Print the certificate
    </button>
  );
}
