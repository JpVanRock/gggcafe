"use client";

// Grade a BP round swing by swing: tap 0-5 for each, undo the last, save the round.
import { useActionState, useState } from "react";
import { Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { QAB_SCALE, qabSummary } from "@/lib/box-score";
import { saveBpRound } from "../actions";

export function BpRoundForm({ players, today }: { players: { id: string; short: string }[]; today: string }) {
  const [swings, setSwings] = useState<number[]>([]);
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, fd: FormData) => {
    const res = await saveBpRound(prev, fd);
    if (!res.error) setSwings([]);
    return res;
  }, initialFormState);
  const summary = qabSummary(swings);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Hitter">
          <select name="player_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" name="round_date" defaultValue={today} className={inputClass} />
        </Field>
        <Field label="Note (optional)">
          <input name="note" maxLength={200} placeholder="Front toss, inside pitch" className={inputClass} />
        </Field>
      </div>
      <input type="hidden" name="grades" value={swings.join("")} />
      <div>
        <p className="mb-2 text-xs text-muted">Tap a grade for each swing. 5 hard-hit · 4 hard-hit out · 3 solid · 2 weak contact · 1 miss-hit · 0 swing and miss.</p>
        <div className="grid grid-cols-6 gap-2 sm:max-w-md">
          {[5, 4, 3, 2, 1, 0].map((g) => (
            <button
              key={g}
              type="button"
              disabled={swings.length >= 100}
              onClick={() => setSwings((s) => [...s, g])}
              title={QAB_SCALE.find((x) => x.grade === g)?.label}
              className={`rounded-xl border py-3 font-display text-2xl font-bold tabular-nums transition ${
                g >= 3 ? "border-neon/60 text-highlight hover:bg-neon/10" : "border-navy-600 text-ink hover:border-pink"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-mono tabular-nums">
            {summary.graded} swing{summary.graded === 1 ? "" : "s"}
            {summary.production !== null && ` · production ${summary.production.toFixed(2)}`}
          </span>
          {swings.length > 0 && (
            <>
              <button type="button" onClick={() => setSwings((s) => s.slice(0, -1))} className="text-xs font-semibold text-pink-soft hover:underline">
                Undo last
              </button>
              <button type="button" onClick={() => setSwings([])} className="text-xs text-muted hover:text-danger">
                Clear
              </button>
            </>
          )}
        </div>
        {swings.length > 0 && <p className="mt-1 font-mono text-xs tracking-wider break-all text-muted">{swings.join(" ")}</p>}
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending || swings.length === 0} className={buttonClass}>
          {pending ? "Saving…" : "Save round"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
