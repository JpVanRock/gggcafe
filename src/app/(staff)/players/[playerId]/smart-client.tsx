"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { GOAL_METHODS, GOAL_METHOD_LABEL, SKILL_AREAS, SKILL_AREA_LABEL, type GoalMethod } from "@/lib/softball";
import { saveSmartGoal, setGoalMethod } from "./goals-actions";
import type { MetricOption, SmartGoal } from "./data";

const METHOD_BLURB: Record<GoalMethod, string> = {
  harada: "One big goal, 8 areas, up to 64 actions. The full commitment.",
  smart: "A few clear goals that are Specific, Measurable, Achievable, Relevant and Time-bound. Lighter to start.",
};

/** Lets a coach pick which goal method this player's dashboard uses. */
export function GoalMethodSwitch({ playerId, method, canEdit }: { playerId: string; method: GoalMethod; canEdit: boolean }) {
  const [current, setCurrent] = useOptimistic(method);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div role="radiogroup" aria-label="Goal method" className="grid gap-2 sm:grid-cols-2">
        {GOAL_METHODS.map((m) => {
          const selected = current === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!canEdit || pending}
              onClick={() => {
                if (selected) return;
                startTransition(async () => {
                  setCurrent(m);
                  const result = await setGoalMethod({ playerId, method: m });
                  setError(result.error);
                });
              }}
              className={`rounded-xl border-2 p-3 text-left transition ${
                selected ? "border-neon bg-neon/10" : "border-navy-700 hover:border-pink disabled:hover:border-navy-700"
              } ${!canEdit && !selected ? "opacity-50" : ""}`}
            >
              <span className={`block text-sm font-bold tracking-wider uppercase ${selected ? "text-highlight" : "text-ink"}`}>
                {GOAL_METHOD_LABEL[m]}
                {selected && <span className="ml-2 font-mono text-2xs text-pink-soft">In use</span>}
              </span>
              <span className="mt-1 block text-xs text-muted">{METHOD_BLURB[m]}</span>
            </button>
          );
        })}
      </div>
      {pending && <p className="mt-2 text-xs text-muted">Switching…</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SmartGoalForm({
  playerId,
  goal,
  metrics,
}: {
  playerId: string;
  goal?: SmartGoal;
  metrics: MetricOption[];
}) {
  const [state, action, pending] = useActionState(saveSmartGoal, initialFormState);
  const letter = (l: string) => <span className="mr-1 font-mono font-bold text-highlight">{l}</span>;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="player_id" value={playerId} />
      {goal && <input type="hidden" name="id" value={goal.id} />}

      <div className="sm:col-span-2">
        <Field label="Goal" hint="One short sentence">
          <input name="title" required defaultValue={goal?.title ?? ""} placeholder="Get to first faster on slaps" className={inputClass} />
        </Field>
      </div>
      <Field label="Area">
        <select name="area" defaultValue={goal?.area ?? "other"} className={inputClass}>
          {SKILL_AREAS.map((a) => (
            <option key={a} value={a}>
              {SKILL_AREA_LABEL[a]}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          {letter("T")}Time-bound: by when?
        </span>
        <input type="date" name="target_date" defaultValue={goal?.target_date ?? ""} className={inputClass} />
      </label>

      {(
        [
          ["specific", "S", "Specific: exactly what?", "Beat the throw on slap hits to the left side"],
          ["measurable", "M", "Measurable: how will we know?", "Home-to-first on slaps under 2.85 sec"],
          ["achievable", "A", "Achievable: what makes it realistic?", "Sprint work twice a week with Coach"],
          ["relevant", "R", "Relevant: why does it matter?", "Speed is my game as a slapper"],
        ] as const
      ).map(([name, l, label, placeholder]) => (
        <label key={name} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {letter(l)}
            {label}
          </span>
          <textarea name={name} rows={2} defaultValue={goal?.[name] ?? ""} placeholder={placeholder} className={inputClass} />
        </label>
      ))}

      <fieldset className="grid gap-3 rounded-xl border border-navy-700 p-3 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">Track it with a measurement (optional)</legend>
        <Field label="Measurement">
          <select name="metric_key" defaultValue={goal?.metric_key ?? ""} className={inputClass}>
            <option value="">—</option>
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name} ({m.unit})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target" hint="e.g. 63 or 2.85">
          <input name="target_value" inputMode="decimal" defaultValue={goal?.target_value ?? ""} className={inputClass} />
        </Field>
      </fieldset>

      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : goal ? "Save goal" : "Add SMART goal"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
