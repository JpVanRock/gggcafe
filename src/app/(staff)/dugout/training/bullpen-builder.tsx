"use client";

// Coaches write a bullpen script: pitch by pitch (type, target zone, intent, count).
import { useState, useTransition } from "react";
import { FormMessage, buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { COUNTS, INTENTS, INTENT_LABEL, MAX_PITCHES, PITCH_TYPES, ZONES, fullCountFinish, zoneLabel, type ScriptPitch } from "@/lib/bullpen";
import { saveBullpenScript } from "./actions";

const blank: ScriptPitch = { pitch: "Fastball", zone: 5, intent: "strike", count: null };

export function BullpenBuilder({
  teamId,
  script,
}: {
  teamId: string;
  script?: { id: string; name: string; notes: string | null; pitches: ScriptPitch[] };
}) {
  const [name, setName] = useState(script?.name ?? "");
  const [notes, setNotes] = useState(script?.notes ?? "");
  const [pitches, setPitches] = useState<ScriptPitch[]>(script?.pitches ?? [{ ...blank }]);
  const [message, setMessage] = useState<{ error: string | null; saved?: boolean }>({ error: null });
  const [pending, startTransition] = useTransition();
  const set = (i: number, patch: Partial<ScriptPitch>) => setPitches((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const select = `${inputClass} py-1 text-sm`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Script name, e.g. Command day" aria-label="Script name" className={inputClass} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Notes (optional)" aria-label="Notes" className={inputClass} />
      </div>
      <ol className="flex flex-col gap-2">
        {pitches.map((p, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-navy-700 p-2">
            <span className="w-6 text-right font-display font-bold text-muted tabular-nums">{i + 1}</span>
            <select value={p.pitch} onChange={(e) => set(i, { pitch: e.target.value as ScriptPitch["pitch"] })} aria-label={`Pitch ${i + 1} type`} className={select}>
              {PITCH_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select value={p.zone} onChange={(e) => set(i, { zone: Number(e.target.value) })} aria-label={`Pitch ${i + 1} zone`} className={select}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z} · {zoneLabel(z)}
                </option>
              ))}
            </select>
            <select value={p.intent} onChange={(e) => set(i, { intent: e.target.value as ScriptPitch["intent"] })} aria-label={`Pitch ${i + 1} intent`} className={select}>
              {INTENTS.map((t) => (
                <option key={t} value={t}>
                  {INTENT_LABEL[t]}
                </option>
              ))}
            </select>
            <select value={p.count ?? ""} onChange={(e) => set(i, { count: e.target.value || null })} aria-label={`Pitch ${i + 1} count`} className={select}>
              <option value="">No count</option>
              {COUNTS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button type="button" onClick={() => setPitches((list) => list.filter((_, j) => j !== i))} disabled={pitches.length === 1} className="ml-auto text-xs text-muted hover:text-danger">
              Remove
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pitches.length >= MAX_PITCHES} onClick={() => setPitches((list) => [...list, { ...(list.at(-1) ?? blank) }])} className={secondaryButtonClass}>
          + Pitch
        </button>
        <button
          type="button"
          disabled={pitches.length + 3 > MAX_PITCHES}
          onClick={() => setPitches((list) => [...list, ...fullCountFinish(["Drop", "Change-up", "Fastball"])])}
          className={secondaryButtonClass}
        >
          + Full-count finish
        </button>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveBullpenScript({ id: script?.id ?? null, teamId, name, notes, pitches });
              setMessage(res.error ? { error: res.error } : { error: null, saved: true });
              if (!res.error && !script) {
                setName("");
                setNotes("");
                setPitches([{ ...blank }]);
              }
            })
          }
          className={buttonClass}
        >
          {pending ? "Saving…" : script ? "Save script" : "Add script"}
        </button>
        <span className="text-xs text-muted">{pitches.length} pitches</span>
        <FormMessage error={message.error} saved={message.saved} />
      </div>
    </div>
  );
}
