"use client";

// Throwing a scripted bullpen on her phone: one pitch at a time (type, target, intent,
// count), tap Hit or Missed; at the end, her command by pitch type and Save.
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { ZoneGrid } from "@/components/zone-grid";
import { INTENT_LABEL, commandByPitch, sessionPct, zoneLabel, type ResultPitch, type ScriptPitch } from "@/lib/bullpen";
import { initialFormState } from "@/lib/form";
import { saveBullpenSession, savePitcherPlan } from "./pitching-actions";

export function BullpenRunner({ playerId, scriptId, pitches, canEdit, backHref }: { playerId: string; scriptId: string; pitches: ScriptPitch[]; canEdit: boolean; backHref: string }) {
  const [results, setResults] = useState<ResultPitch[]>([]);
  const [saved, setSaved] = useState<null | { checked: boolean }>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const i = results.length;
  const done = i >= pitches.length;
  const p = pitches[Math.min(i, pitches.length - 1)];
  const mark = (hit: boolean) => setResults((r) => [...r, { ...pitches[r.length], hit }]);

  if (done) {
    const command = commandByPitch([{ results }]);
    return (
      <div className="flex flex-col gap-5">
        <p className="font-display text-5xl font-black text-highlight tabular-nums">{sessionPct(results)}%</p>
        <p className="text-sm text-muted">Command: pitches that hit their spot.</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {command.map((c) => (
            <li key={c.pitch} className="rounded-xl border border-navy-700 p-3">
              <p className="font-semibold">{c.pitch}</p>
              <p className="font-display text-2xl font-bold tabular-nums">
                {c.pct}% <span className="text-xs font-normal text-muted">{c.hits}/{c.thrown}</span>
              </p>
            </li>
          ))}
        </ul>
        {canEdit && !saved && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await saveBullpenSession({ playerId, scriptId, results });
                  if (res.error) return setError(res.error);
                  setSaved({ checked: Boolean(res.checked) });
                })
              }
              className={buttonClass}
            >
              {pending ? "Saving…" : "Save bullpen"}
            </button>
            <button type="button" onClick={() => setResults([])} className={secondaryButtonClass}>
              Start over
            </button>
          </div>
        )}
        {saved && (
          <p role="status" className="rounded-xl border border-neon/60 bg-neon/10 p-4 text-sm">
            Saved{saved.checked ? " and checked off in TWIS" : ""}. Your command by pitch type is on your Performance Training page.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Link href={backHref} className="text-sm text-pink hover:underline">
          ← Performance Training
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-navy-800" aria-hidden>
        <div className="h-full bg-linear-to-r from-pink to-neon" style={{ width: `${(i / pitches.length) * 100}%` }} />
      </div>
      <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">
        Pitch {i + 1} of {pitches.length}
        {p.count ? ` · Count ${p.count}` : ""}
      </p>
      <p className="font-display text-5xl leading-none font-black tracking-tight text-highlight uppercase">{p.pitch}</p>
      <p className="text-sm text-muted">
        {zoneLabel(p.zone)} · {INTENT_LABEL[p.intent]}
      </p>
      {p.zone <= 9 ? <ZoneGrid zones={{ hot: [p.zone], strong: [], weak: [] }} size={150} labels={false} /> : <p className="rounded-lg border border-pink px-4 py-6 text-center font-semibold">{zoneLabel(p.zone)}</p>}
      <p className="text-xs text-muted">Catcher&apos;s view</p>
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <button type="button" onClick={() => mark(false)} className="rounded-xl border-2 border-navy-600 py-4 text-lg font-bold uppercase transition hover:border-pink">
          Missed
        </button>
        <button type="button" onClick={() => mark(true)} className="rounded-xl bg-neon py-4 text-lg font-bold text-on-accent uppercase transition hover:bg-neon-bright">
          Hit it
        </button>
      </div>
      {i > 0 && (
        <button type="button" onClick={() => setResults((r) => r.slice(0, -1))} className="text-xs text-muted underline">
          Undo last pitch
        </button>
      )}
    </div>
  );
}

export function GamePlanForm({
  playerId,
  gameId,
  planDate,
  opponent,
  plan,
  after,
}: {
  playerId: string;
  gameId: string | null;
  planDate: string;
  opponent: string;
  plan: Partial<Record<"first_pitch" | "out_pitch" | "reset" | "watch" | "worked" | "fix", string | null>> & { strike_pct?: number | null } | null;
  /** the game is over: ask for the look-back too */
  after: boolean;
}) {
  const [state, action, pending] = useActionState(savePitcherPlan, initialFormState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="player_id" value={playerId} />
      {gameId && <input type="hidden" name="game_id" value={gameId} />}
      <input type="hidden" name="plan_date" value={planDate} />
      <input type="hidden" name="opponent" value={opponent} />
      <Field label="First-pitch plan" hint="What you'll throw to get ahead">
        <input name="first_pitch" maxLength={300} defaultValue={plan?.first_pitch ?? ""} className={inputClass} />
      </Field>
      <Field label="My out pitch" hint="Your two-strike pitch today">
        <input name="out_pitch" maxLength={300} defaultValue={plan?.out_pitch ?? ""} className={inputClass} />
      </Field>
      <Field label="After a walk or an error" hint="Your reset">
        <input name="reset" maxLength={300} defaultValue={plan?.reset ?? ""} className={inputClass} />
      </Field>
      <Field label="Hitters to watch">
        <input name="watch" maxLength={500} defaultValue={plan?.watch ?? ""} className={inputClass} />
      </Field>
      {after && (
        <>
          <Field label="After: what worked">
            <textarea name="worked" rows={2} maxLength={500} defaultValue={plan?.worked ?? ""} className={inputClass} />
          </Field>
          <Field label="After: what I'll fix">
            <textarea name="fix" rows={2} maxLength={500} defaultValue={plan?.fix ?? ""} className={inputClass} />
          </Field>
          <Field label="Strike % (optional)">
            <input name="strike_pct" inputMode="numeric" defaultValue={plan?.strike_pct ?? ""} className={`${inputClass} w-24`} />
          </Field>
        </>
      )}
      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : after ? "Save" : "Save my plan"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}
