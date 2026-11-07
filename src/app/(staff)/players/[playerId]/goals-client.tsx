"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { saveGoals, setGoalActionDone } from "./actions";
import type { HaradaChart } from "./data";

export function GoalActionCheckbox({ actionId, title, done }: { actionId: string; title: string; done: boolean }) {
  const [isDone, setDone] = useOptimistic(done);
  const [, startTransition] = useTransition();
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-pink"
        checked={isDone}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            setDone(next);
            await setGoalActionDone({ actionId, done: next });
          });
        }}
      />
      <span className={`text-sm ${isDone ? "text-muted line-through decoration-pink decoration-2" : ""}`}>{title}</span>
    </label>
  );
}

export function GoalsForm({ playerId, chart }: { playerId: string; chart: HaradaChart | null }) {
  const [state, action, pending] = useActionState(saveGoals, initialFormState);
  const pillar = (n: number) => chart?.pillars.find((p) => p.position === n);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="player_id" value={playerId} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Main goal" hint="The one big goal in the middle of the chart">
          <textarea name="main_goal" required rows={2} defaultValue={chart?.main_goal ?? ""} className={inputClass} />
        </Field>
        <Field label="Target date">
          <input type="date" name="target_date" defaultValue={chart?.target_date ?? ""} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Why it matters" hint="The player's own reason. Harada starts here.">
            <textarea name="purpose" rows={2} defaultValue={chart?.purpose ?? ""} className={inputClass} />
          </Field>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">The 8 areas and their actions</p>
        <p className="mt-1 text-xs text-muted">
          Name each area that supports the main goal (skills, body, mind, habits…), then up to 8 concrete actions for it. Leave
          blanks empty.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => {
          const p = pillar(i + 1);
          return (
            <fieldset key={i} className="rounded-xl border border-navy-700 p-4">
              <legend className="px-1 font-mono text-xs font-bold tracking-widest text-neon uppercase">Area {i + 1}</legend>
              <input
                name={`pillar_${i + 1}`}
                aria-label={`Area ${i + 1} name`}
                placeholder="Area name, e.g. Hitting power"
                defaultValue={p?.title ?? ""}
                className={`${inputClass} font-semibold`}
              />
              <ol className="mt-3 grid gap-1.5">
                {Array.from({ length: 8 }, (_, j) => (
                  <li key={j} className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-right font-mono text-xs text-muted">{j + 1}</span>
                    <input
                      name={`pillar_${i + 1}_action_${j + 1}`}
                      aria-label={`Area ${i + 1}, action ${j + 1}`}
                      defaultValue={p?.actions.find((a) => a.position === j + 1)?.title ?? ""}
                      className={`${inputClass} py-1.5 text-sm`}
                    />
                  </li>
                ))}
              </ol>
            </fieldset>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-4 bg-navy-900/95 px-1 py-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save goal chart"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
