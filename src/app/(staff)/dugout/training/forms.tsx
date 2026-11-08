"use client";

// Forms for Coaches Dugout → Training: phases, the backward-planned roadmap, team
// routines, testing results, rating bands and the draft setup.
import { useActionState, useMemo, useState } from "react";
import { Field, FormMessage, buttonClass, fieldClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { WEEKDAYS } from "@/lib/dates";
import { TRAINING_CATEGORIES, TRAINING_CATEGORY_LABEL, type TrainingCategory } from "@/lib/achievements";
import { PHASE_INFO, PHASE_KINDS, SQUAD_MAX, SQUAD_MIN, TESTS, type PhaseKind } from "@/lib/training-plan";
import { createSquads, saveBands, savePhase, saveResults, saveTeamRoutine, suggestPhases, type TrainingState } from "./actions";
import type { LibraryDrill, PhaseRow, RosterPlayer } from "./data";

const FOCUS_LABEL: Record<string, string> = { speed: "Speed", agility: "Agility", core: "Core", power: "Power", "med-ball": "Med ball", landing: "Landing / ACL" };

function Message({ state }: { state: TrainingState }) {
  return (
    <>
      <FormMessage error={state.error} saved={state.saved && !state.message} />
      {state.message && !state.error && <span className="text-sm font-semibold text-highlight">{state.message}</span>}
    </>
  );
}

export function PhaseForm({ teamId, phase }: { teamId: string; phase?: PhaseRow }) {
  const [state, action, pending] = useActionState(savePhase, initialFormState);
  const [kind, setKind] = useState<PhaseKind>(phase?.kind ?? "build");
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="team_id" value={teamId} />
      {phase && <input type="hidden" name="id" value={phase.id} />}
      <Field label="Kind">
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as PhaseKind)} className={inputClass}>
          {PHASE_KINDS.map((k) => (
            <option key={k} value={k}>
              {PHASE_INFO[k].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Name">
        <input name="name" required maxLength={60} defaultValue={phase?.name ?? PHASE_INFO[kind].label} key={phase ? "fixed" : kind} className={inputClass} />
      </Field>
      <Field label="Starts">
        <input type="date" name="starts_on" required defaultValue={phase?.starts_on} className={inputClass} />
      </Field>
      <Field label="Ends">
        <input type="date" name="ends_on" required defaultValue={phase?.ends_on} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Focus" hint="What this phase is for (players see it in TWIS)">
          <input name="focus" maxLength={300} defaultValue={phase?.focus ?? PHASE_INFO[kind].focus} key={phase ? "fixed-focus" : `${kind}-focus`} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : phase ? "Save phase" : "Add phase"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function SuggestForm({ teamId, start, firstGame, hasPhases }: { teamId: string; start: string; firstGame: string | null; hasPhases: boolean }) {
  const [state, action, pending] = useActionState(suggestPhases, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="Start" hint="Usually the first day of the offseason">
        <input type="date" name="start" required defaultValue={start} className={inputClass} />
      </Field>
      <Field label="First game">
        <input type="date" name="first_game" required defaultValue={firstGame ?? ""} className={inputClass} />
      </Field>
      <Field label="Championship" hint="The last date that matters">
        <input type="date" name="championship" required className={inputClass} />
      </Field>
      <p className="text-xs text-muted sm:col-span-3">
        Planned backward: in-season from the first game, a 3-week preseason, a retest week, 6 weeks sport-specific, and a testing week then
        build from the start. Change any phase afterward.
      </p>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
        {hasPhases && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="replace" className="size-4 accent-pink" /> Replace the current roadmap
          </label>
        )}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Planning…" : "Plan the roadmap"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function TeamRoutineForm({
  teamId,
  phases,
  library,
  scripts = [],
  today,
}: {
  teamId: string;
  phases: PhaseRow[];
  library: LibraryDrill[];
  /** bullpen scripts (pitching routines can carry one) */
  scripts?: { id: string; name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(saveTeamRoutine, initialFormState);
  const current = phases.find((p) => p.starts_on <= today && today <= p.ends_on) ?? phases.find((p) => p.starts_on > today) ?? null;
  const [phaseId, setPhaseId] = useState(current?.id ?? "");
  const [category, setCategory] = useState<TrainingCategory>("workout");
  const [drill, setDrill] = useState("");
  const [script, setScript] = useState("");
  const phase = phases.find((p) => p.id === phaseId) ?? null;
  const drills = useMemo(() => library.filter((d) => d.category === category), [library, category]);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="Phase" hint="Sets the dates; optional">
        <select name="phase_id" value={phaseId} onChange={(e) => setPhaseId(e.target.value)} className={inputClass}>
          <option value="">No phase</option>
          {phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Category">
        <select
          name="category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as TrainingCategory);
            setDrill("");
          }}
          className={inputClass}
        >
          {TRAINING_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TRAINING_CATEGORY_LABEL[c].title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="From the library">
        <select name="drill_id" value={drill} onChange={(e) => setDrill(e.target.value)} className={inputClass}>
          <option value="">Something else (name it)</option>
          {drills.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.focus ? ` · ${FOCUS_LABEL[d.focus] ?? d.focus}` : ""}
            </option>
          ))}
        </select>
      </Field>
      {category === "pitching" && scripts.length > 0 && (
        <Field label="Bullpen script" hint="Optional: TWIS shows Start on it">
          <select name="bullpen_script_id" value={script} onChange={(e) => setScript(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {scripts.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!drill && (
        <Field label="Routine name" hint={script ? "Leave blank to use the script's name" : undefined}>
          <input name="title" required={!script} maxLength={120} placeholder="Tee work: 50 swings" className={inputClass} />
        </Field>
      )}
      <Field label="How much" hint="Sets, reps, time">
        <input name="details" maxLength={500} placeholder="3 × 8, 60 sec rest" className={inputClass} />
      </Field>
      <fieldset className={drill ? "" : "sm:col-span-2"}>
        <legend className="mb-1.5 text-sm font-medium">Which days?</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {WEEKDAYS.map((d) => (
            <label key={d.n} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="days" value={d.n} className="size-4 accent-pink" />
              {d.short}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">None ticked: once a week, any day.</p>
      </fieldset>
      <Field label="Starts">
        <input type="date" name="starts_on" required defaultValue={phase && phase.starts_on > today ? phase.starts_on : today} key={`s-${phaseId}`} className={inputClass} />
      </Field>
      <Field label="Ends" hint="Optional">
        <input type="date" name="ends_on" defaultValue={phase?.ends_on ?? ""} key={`e-${phaseId}`} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Pushing…" : "Push to the team"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function ResultsForm({ roster, today }: { roster: RosterPlayer[]; today: string }) {
  const [state, action, pending] = useActionState(saveResults, initialFormState);
  const [picked, setPicked] = useState<string[]>(["pro_agility", "sprint_20yd", "broad_jump"]);
  const tests = TESTS.filter((t) => picked.includes(t.key));
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Test date">
          <input type="date" name="measured_on" required defaultValue={today} className={inputClass} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Tests today</legend>
        <div className="flex flex-wrap gap-1.5">
          {TESTS.map((t) => (
            <label
              key={t.key}
              className="cursor-pointer rounded-full border border-navy-600 px-2.5 py-1 text-xs font-semibold text-muted select-none has-checked:border-pink has-checked:bg-pink has-checked:text-on-accent"
            >
              <input
                type="checkbox"
                checked={picked.includes(t.key)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.key] : p.filter((k) => k !== t.key)))}
                className="sr-only"
              />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>
      {tests.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3 text-left text-[0.75rem] leading-4 font-semibold tracking-wider text-muted uppercase">Player</th>
                {tests.map((t) => (
                  <th key={t.key} className="px-1 py-2 text-left text-[0.75rem] leading-4 font-semibold tracking-wider text-muted uppercase">
                    {t.name.replace(/ \(.*\)/, "")}
                    <span className="block font-normal normal-case">{t.unit}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.id} className="border-t border-navy-800">
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {p.jersey && <span className="mr-1.5 font-display font-bold text-muted tabular-nums">#{p.jersey}</span>}
                    {p.name}
                  </td>
                  {tests.map((t) => (
                    <td key={t.key} className="px-1 py-1.5">
                      <input name={`v:${p.id}:${t.key}`} inputMode="decimal" aria-label={`${p.name}: ${t.name}`} className={`${fieldClass} w-20 py-1 tabular-nums`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending || tests.length === 0} className={buttonClass}>
          {pending ? "Saving…" : "Save results"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function BandsForm({ ageGroup, bands }: { ageGroup: string; bands: { key: string; cutoffs: number[]; own: boolean }[] }) {
  const [state, action, pending] = useActionState(saveBands, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="age_group" value={ageGroup} />
      <p className="text-xs text-muted">
        Four cutoffs split the five ratings (Building, Developing, Solid, Strong, Elite). A result at or past a cutoff earns the next rating.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <tbody>
            {TESTS.map((t) => {
              const row = bands.find((b) => b.key === t.key)!;
              return (
                <tr key={t.key} className="border-t border-navy-800">
                  <td className="py-2 pr-3">
                    <span className="block font-semibold">{t.name}</span>
                    <span className="text-xs text-muted">
                      {t.unit} · {t.better === "higher" ? "higher is better" : "lower is better"}
                      {row.own ? " · your bands" : " · starter bands"}
                    </span>
                  </td>
                  {row.cutoffs.map((c, i) => (
                    <td key={i} className="px-1 py-2">
                      <input name={`c:${t.key}:${i}`} defaultValue={c} inputMode="decimal" aria-label={`${t.name} cutoff ${i + 1}`} className={`${fieldClass} w-20 py-1 tabular-nums`} />
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    {row.own && (
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input type="checkbox" name={`reset:${t.key}`} className="size-4 accent-pink" /> Back to starter
                      </label>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : `Save ${ageGroup} bands`}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function SquadsForm({ teamId, roster }: { teamId: string; roster: RosterPlayer[] }) {
  const [state, action, pending] = useActionState(createSquads, initialFormState);
  const [count, setCount] = useState(Math.min(4, Math.max(SQUAD_MIN, Math.floor(roster.length / 3))));
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="How many squads?">
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={`${fieldClass} w-24`}>
          {Array.from({ length: SQUAD_MAX - SQUAD_MIN + 1 }, (_, i) => i + SQUAD_MIN).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      <ol className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="grid gap-2 rounded-xl border border-navy-700 p-3">
            <p className="font-mono text-[11px] tracking-widest text-pink-soft uppercase">Picks {i === 0 ? "first" : `#${i + 1}`}</p>
            <input name={`name:${i}`} required maxLength={40} placeholder={`Squad ${i + 1} name`} aria-label={`Squad ${i + 1} name`} className={inputClass} />
            <select name={`captain:${i}`} required defaultValue="" aria-label={`Squad ${i + 1} captain`} className={inputClass}>
              <option value="" disabled>
                Captain…
              </option>
              {roster.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jersey ? `#${p.jersey} ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Set up the squads"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
