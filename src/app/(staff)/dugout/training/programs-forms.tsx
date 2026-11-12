"use client";

// The head coach's editors for the Team Hitting Philosophy and the Throwing Program
// (user, 2026-11-12): ordered rows with move/remove, and a starter to load and edit.
import { useActionState, useState } from "react";
import { Card, Field, FormMessage, cardClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { confirmAction } from "@/components/confirm-submit";
import { initialFormState } from "@/lib/form";
import {
  PHILOSOPHY_SECTIONS_MAX, PHILOSOPHY_STARTER, PHILOSOPHY_STATEMENT_MAX, PROGRAM_INTRO_MAX, PROGRAM_STEPS_MAX, SECTION_BODY_MAX,
  SECTION_TITLE_MAX, STEP_CUE_MAX, STEP_DOSE_MAX, STEP_NAME_MAX, THROWING_STARTERS, throwGroup,
  type PhilosophySection, type ThrowGroup, type ThrowStep,
} from "@/lib/team-programs";
import { saveHittingPhilosophy, saveThrowingProgram } from "./programs-actions";

const small = "rounded-md border border-navy-600 px-2 py-1 text-xs text-muted transition hover:border-pink hover:text-ink disabled:opacity-40";

type Keyed<T> = T & { key: number };

/** Ordered rows with stable keys: add, move, remove, replace all. */
function useRows<T>(initial: T[], blank: T) {
  const [rows, setRows] = useState<Keyed<T>[]>(() => (initial.length ? initial : [blank]).map((r, i) => ({ ...r, key: i })));
  const [next, setNext] = useState(rows.length);
  return {
    rows,
    add: () => {
      setRows((list) => [...list, { ...blank, key: next }]);
      setNext((n) => n + 1);
    },
    move: (i: number, by: -1 | 1) =>
      setRows((list) => {
        const out = [...list];
        [out[i], out[i + by]] = [out[i + by], out[i]];
        return out;
      }),
    remove: (key: number) => setRows((list) => list.filter((r) => r.key !== key)),
    set: (key: number, patch: Partial<T>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r))),
    replace: (items: T[]) => {
      setRows(items.map((r, i) => ({ ...r, key: next + i })));
      setNext((n) => n + items.length);
    },
  };
}

function RowControls({ i, count, label, onMove, onRemove }: { i: number; count: number; label: string; onMove: (by: -1 | 1) => void; onRemove: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="font-display text-sm font-bold text-highlight tabular-nums">{String(i + 1).padStart(2, "0")}</span>
      <div className="flex gap-1.5">
        <button type="button" className={small} onClick={() => onMove(-1)} disabled={i === 0} aria-label={`Move ${label} ${i + 1} up`}>
          ↑
        </button>
        <button type="button" className={small} onClick={() => onMove(1)} disabled={i === count - 1} aria-label={`Move ${label} ${i + 1} down`}>
          ↓
        </button>
        <button type="button" className={`${small} hover:text-danger`} onClick={onRemove} aria-label={`Remove ${label} ${i + 1}`}>
          Remove
        </button>
      </div>
    </div>
  );
}

/** Asks first when the form already has words in it. */
async function okToReplace(hasWords: boolean) {
  return !hasWords || confirmAction("Replace what's in the form with the starter? Nothing is saved until you press Save.", { confirmLabel: "Replace", tone: "primary" });
}

export function PhilosophyForm({ teamId, statement, sections }: { teamId: string; statement: string | null; sections: PhilosophySection[] }) {
  const [state, action] = useActionState(saveHittingPhilosophy, initialFormState);
  const [words, setWords] = useState(statement ?? "");
  const list = useRows<PhilosophySection>(sections, { title: "", body: "" });

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="team_id" value={teamId} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={async () => {
            if (!(await okToReplace(Boolean(words.trim()) || list.rows.some((r) => r.title.trim() || r.body.trim())))) return;
            setWords(PHILOSOPHY_STARTER.statement);
            list.replace(PHILOSOPHY_STARTER.sections);
          }}
        >
          Load the starter
        </button>
        <p className="text-sm text-muted">A starting point in our words. Make it yours, then save.</p>
      </div>
      <Field label="Our philosophy" hint="Two or three sentences every hitter can repeat">
        <textarea
          name="statement"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          maxLength={PHILOSOPHY_STATEMENT_MAX}
          rows={3}
          placeholder="We are on time, on the attack and hard to get out…"
          className={inputClass}
        />
      </Field>
      <Card title="Sections">
        <p className="mb-4 text-sm text-muted">Our approach by count, the situations we win, what counts as a quality at-bat, the words we use.</p>
        <ol className="flex flex-col gap-4">
          {list.rows.map((row, i) => (
            <li key={row.key} className={`${cardClass("inset")} p-3`}>
              <RowControls i={i} count={list.rows.length} label="section" onMove={(by) => list.move(i, by)} onRemove={() => list.remove(row.key)} />
              <input
                name="section_title"
                value={row.title}
                onChange={(e) => list.set(row.key, { title: e.target.value })}
                maxLength={SECTION_TITLE_MAX}
                placeholder="With two strikes, we battle"
                aria-label={`Section ${i + 1} title`}
                className={inputClass}
              />
              <textarea
                name="section_body"
                value={row.body}
                onChange={(e) => list.set(row.key, { body: e.target.value })}
                maxLength={SECTION_BODY_MAX}
                rows={3}
                placeholder="What it looks like in the box"
                aria-label={`Section ${i + 1}`}
                className={`${inputClass} mt-2 text-sm`}
              />
            </li>
          ))}
        </ol>
        <button type="button" onClick={list.add} disabled={list.rows.length >= PHILOSOPHY_SECTIONS_MAX} className={`${secondaryButtonClass} mt-4`}>
          + Add a section
        </button>
      </Card>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>Save the hitting philosophy</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export function ThrowingForm({ teamId, grp, intro, steps }: { teamId: string; grp: ThrowGroup; intro: string | null; steps: ThrowStep[] }) {
  const [state, action] = useActionState(saveThrowingProgram, initialFormState);
  const [words, setWords] = useState(intro ?? "");
  const list = useRows<ThrowStep>(steps, { name: "", dose: null, cue: null });
  const group = throwGroup(grp);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="grp" value={grp} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={async () => {
            if (!(await okToReplace(Boolean(words.trim()) || list.rows.some((r) => r.name.trim())))) return;
            setWords(THROWING_STARTERS[grp].intro);
            list.replace(THROWING_STARTERS[grp].steps);
          }}
        >
          Load the {group.label} starter
        </button>
        <p className="text-sm text-muted">Short to long, then position work. Edit the throws, distances and cues to fit your team.</p>
      </div>
      <Field label={`Why it matters for ${group.full.toLowerCase()}`} hint="Shown above the throws">
        <textarea
          name="intro"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          maxLength={PROGRAM_INTRO_MAX}
          rows={3}
          className={inputClass}
        />
      </Field>
      <Card title={`${group.label} throws, in order`}>
        <ol className="flex flex-col gap-4">
          {list.rows.map((row, i) => (
            <li key={row.key} className={`${cardClass("inset")} p-3`}>
              <RowControls i={i} count={list.rows.length} label="throw" onMove={(by) => list.move(i, by)} onRemove={() => list.remove(row.key)} />
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                <input
                  name="step_name"
                  value={row.name}
                  onChange={(e) => list.set(row.key, { name: e.target.value })}
                  maxLength={STEP_NAME_MAX}
                  placeholder="Crow-hop throws"
                  aria-label={`Throw ${i + 1} name`}
                  className={inputClass}
                />
                <input
                  name="step_dose"
                  value={row.dose ?? ""}
                  onChange={(e) => list.set(row.key, { dose: e.target.value })}
                  maxLength={STEP_DOSE_MAX}
                  placeholder="10 throws · 60 ft"
                  aria-label={`Throw ${i + 1} reps and distance`}
                  className={inputClass}
                />
              </div>
              <textarea
                name="step_cue"
                value={row.cue ?? ""}
                onChange={(e) => list.set(row.key, { cue: e.target.value })}
                maxLength={STEP_CUE_MAX}
                rows={2}
                placeholder="The cue (optional)"
                aria-label={`Throw ${i + 1} cue`}
                className={`${inputClass} mt-2 text-sm`}
              />
            </li>
          ))}
        </ol>
        <button type="button" onClick={list.add} disabled={list.rows.length >= PROGRAM_STEPS_MAX} className={`${secondaryButtonClass} mt-4`}>
          + Add a throw
        </button>
      </Card>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>Save the {group.label} program</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
