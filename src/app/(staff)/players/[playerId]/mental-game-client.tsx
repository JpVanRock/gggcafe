"use client";

// Forms for the mental-game tools on her Mental GP page.
import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, buttonClass, fieldClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import {
  ADJUSTMENT_MAX, CONTEXT_LABEL, DEFAULT_ZONE, INTENSITY_CONTEXTS, INTENSITY_LEVELS, JOURNAL_LIMITS, JOURNAL_PROMPTS, SCAN_LABELS,
  SCAN_NOTE_MAX, SCAN_SKILLS, SIGNALS, SIGNAL_MAX, ZONE_TIP, zoneStatus,
} from "@/lib/mental";
import { logIntensity, saveJournalEntry, saveJournalWeek, saveScan, saveSignals } from "./mental-actions";
import { SubmitButton } from "@/components/submit-button";

const pill =
  "cursor-pointer rounded-full border border-navy-600 px-2.5 py-1 text-center text-sm font-semibold text-muted transition select-none has-checked:border-pink has-checked:bg-pink has-checked:text-on-accent has-focus-visible:ring-2 has-focus-visible:ring-pink/40";

type Signals = Partial<Record<"green_signs" | "yellow_signs" | "red_signs" | "yellow_release" | "red_release", string | null>> & {
  zone_low?: number | null;
  zone_high?: number | null;
};

export function SignalsForm({ playerId, plan }: { playerId: string; plan: Signals | null }) {
  const [state, action] = useActionState(saveSignals, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="player_id" value={playerId} />
      <div className="grid gap-4 md:grid-cols-3">
        {SIGNALS.map((s) => (
          <fieldset key={s.light} className="flex flex-col gap-3">
            <legend className="mb-1 font-display text-lg font-bold tracking-wide uppercase">{s.label}</legend>
            <Field label="How it feels" hint={s.signsHint}>
              <textarea name={s.signs} rows={3} maxLength={SIGNAL_MAX} defaultValue={plan?.[s.signs] ?? ""} className={inputClass} />
            </Field>
            {s.release && (
              <Field label="My release" hint={s.releaseHint}>
                <textarea name={s.release} rows={2} maxLength={SIGNAL_MAX} defaultValue={plan?.[s.release] ?? ""} className={inputClass} />
              </Field>
            )}
          </fieldset>
        ))}
      </div>
      <fieldset className="flex flex-wrap items-end gap-3">
        <legend className="mb-1.5 text-sm font-medium">My zone: the intensity I play my best at</legend>
        <label className="flex items-center gap-2 text-sm">
          From
          <select name="zone_low" defaultValue={plan?.zone_low ?? ""} className={`${fieldClass} w-20`}>
            <option value="">–</option>
            {INTENSITY_LEVELS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          to
          <select name="zone_high" defaultValue={plan?.zone_high ?? ""} className={`${fieldClass} w-20`}>
            <option value="">–</option>
            {INTENSITY_LEVELS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-2 text-xs text-muted">Not sure yet? Leave it; your intensity checks will show you.</span>
      </fieldset>
      <div className="flex items-center gap-4">
        <SubmitButton>Save my signals</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export function IntensityForm({ playerId, zone }: { playerId: string; zone: { low: number | null; high: number | null } }) {
  const [state, action] = useActionState(logIntensity, initialFormState);
  const [value, setValue] = useState<number | null>(null);
  const status = value === null ? null : zoneStatus(value, zone);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="player_id" value={playerId} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Right now I&apos;m at…</legend>
        <div role="radiogroup" className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
          {INTENSITY_LEVELS.map((n) => (
            <label key={n} className={`${pill} font-display tabular-nums`}>
              <input type="radio" name="level" value={n} required checked={value === n} onChange={() => setValue(n)} className="sr-only" />
              {n}
            </label>
          ))}
        </div>
        <p className="mt-1.5 flex justify-between text-xs text-muted">
          <span>1 flat</span>
          <span>
            Zone {zone.low ?? DEFAULT_ZONE.low}–{zone.high ?? DEFAULT_ZONE.high}
          </span>
          <span>10 too amped</span>
        </p>
      </fieldset>
      {status && (
        <p aria-live="polite" className={`rounded-lg border p-3 text-sm ${status === "in" ? "border-neon/60 bg-neon/5" : "border-pink/60 bg-pink/5"}`}>
          {ZONE_TIP[status]}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="Before a">
          <select name="context" defaultValue="game" className={inputClass}>
            {INTENSITY_CONTEXTS.map((c) => (
              <option key={c} value={c}>
                {CONTEXT_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="My adjustment (optional)" hint="One thing you'll do about it">
          <input name="adjustment" maxLength={ADJUSTMENT_MAX} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <SubmitButton disabled={value === null}>Log it</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export function ScanForm({ playerId, current }: { playerId: string; current: { scores: number[]; note: string | null } | null }) {
  const [scores, setScores] = useState<(number | null)[]>(current?.scores ?? SCAN_SKILLS.map(() => null));
  const [note, setNote] = useState(current?.note ?? "");
  const [message, setMessage] = useState<{ error: string | null; saved?: boolean }>({ error: null });
  const [pending, startTransition] = useTransition();
  const complete = scores.every((s) => s !== null);

  function save() {
    startTransition(async () => {
      const res = await saveScan({ playerId, scores: scores as number[], note });
      setMessage(res.error ? { error: res.error } : { error: null, saved: true });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        {SCAN_LABELS.map((l, i) => `${i + 1} ${l}`).join(" · ")}
      </p>
      <ol className="flex flex-col divide-y divide-navy-800">
        {SCAN_SKILLS.map((skill, i) => (
          <li key={skill.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
            <span className="min-w-0">
              <span className="block font-semibold">{skill.name}</span>
              <span className="block text-xs text-muted">{skill.prompt}</span>
            </span>
            <span role="radiogroup" aria-label={skill.name} className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={`${pill} w-9 px-0 font-display tabular-nums`} title={SCAN_LABELS[n - 1]}>
                  <input
                    type="radio"
                    name={`scan-${skill.key}`}
                    value={n}
                    checked={scores[i] === n}
                    onChange={() => setScores((s) => s.map((v, j) => (j === i ? n : v)))}
                    className="sr-only"
                  />
                  {n}
                </label>
              ))}
            </span>
          </li>
        ))}
      </ol>
      <Field label="A note for this month (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={SCAN_NOTE_MAX} className={inputClass} />
      </Field>
      <div className="flex items-center gap-4">
        <button type="button" onClick={save} disabled={pending || !complete} className={buttonClass}>
          {pending ? "Saving…" : current ? "Update this month's scan" : "Save this month's scan"}
        </button>
        {!complete && <span className="text-xs text-muted">Rate all ten skills to save.</span>}
        <FormMessage error={message.error} saved={message.saved} />
      </div>
    </div>
  );
}

export function JournalDayForm({
  playerId,
  date,
  entry,
}: {
  playerId: string;
  date: string;
  entry: { purpose: string | null; worked: string | null; fix: string | null } | null;
}) {
  const [state, action] = useActionState(saveJournalEntry, initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="player_id" value={playerId} />
      <input type="hidden" name="entry_date" value={date} />
      <Field label={JOURNAL_PROMPTS.purpose.label} hint={JOURNAL_PROMPTS.purpose.hint}>
        <input name="purpose" maxLength={JOURNAL_LIMITS.purpose} defaultValue={entry?.purpose ?? ""} className={inputClass} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={JOURNAL_PROMPTS.worked.label} hint={JOURNAL_PROMPTS.worked.hint}>
          <textarea name="worked" rows={2} maxLength={JOURNAL_LIMITS.worked} defaultValue={entry?.worked ?? ""} className={inputClass} />
        </Field>
        <Field label={JOURNAL_PROMPTS.fix.label} hint={JOURNAL_PROMPTS.fix.hint}>
          <textarea name="fix" rows={2} maxLength={JOURNAL_LIMITS.fix} defaultValue={entry?.fix ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <SubmitButton>Save</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

export function JournalWeekForm({ playerId, monday, lookBack }: { playerId: string; monday: string; lookBack: string | null }) {
  const [state, action] = useActionState(saveJournalWeek, initialFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="player_id" value={playerId} />
      <input type="hidden" name="week_start" value={monday} />
      <Field label={JOURNAL_PROMPTS.lookBack.label} hint={JOURNAL_PROMPTS.lookBack.hint}>
        <textarea name="look_back" rows={4} maxLength={JOURNAL_LIMITS.lookBack} defaultValue={lookBack ?? ""} className={inputClass} />
      </Field>
      <div className="flex items-center gap-4">
        <SubmitButton>Save my look-back</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}
