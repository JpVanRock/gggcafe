"use client";

// In-game substitutions with the re-entry rule: log who comes in for which spot, see
// who's in now, who can still re-enter, and any move the rules don't allow.
import { useState, useTransition } from "react";
import { Card, inputClass } from "@/components/ui";
import { trackSubs, type SubEntry } from "@/lib/gameday";
import { saveSubLog } from "../actions";

const small = `${inputClass} px-2 py-1 text-sm`;

export function SubTracker({
  lineupId,
  starters,
  flexSpot,
  players,
  initial,
}: {
  lineupId: string;
  /** batting order, then the FLEX when there is one */
  starters: string[];
  /** the FLEX line's spot number, or null */
  flexSpot: number | null;
  players: { id: string; short: string }[];
  initial: SubEntry[];
}) {
  const name = new Map(players.map((p) => [p.id, p.short]));
  const [log, setLog] = useState<SubEntry[]>(initial);
  const [draft, setDraft] = useState<{ inning: number; spot: number; in: string }>({ inning: 1, spot: 1, in: "" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { current, checks, canReenter } = trackSubs(starters, log);
  const spotLabel = (spot: number) => (spot === flexSpot ? "FLEX" : String(spot));

  function save(next: SubEntry[]) {
    setLog(next);
    startTransition(async () => {
      const res = await saveSubLog(lineupId, next);
      setError(res.error);
    });
  }

  return (
    <Card title="In the game · substitutions">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-2xs font-bold tracking-wider text-muted uppercase">Lineup now</p>
          <ol className="flex flex-col divide-y divide-navy-800 text-sm">
            {starters.map((_, i) => {
              const spot = i + 1;
              const now = current[spot];
              return (
                <li key={spot} className="flex items-center gap-3 py-1.5">
                  <span className="w-10 font-display font-bold text-highlight tabular-nums">{spotLabel(spot)}</span>
                  <span className={`font-semibold ${now !== starters[i] ? "text-pink-soft" : ""}`}>{name.get(now) ?? "Player"}</span>
                  {now !== starters[i] && <span className="text-xs text-muted">for {name.get(starters[i])}</span>}
                </li>
              );
            })}
          </ol>
          {canReenter.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              Can still re-enter (own spot only): <span className="text-ink">{canReenter.map((id) => name.get(id)).join(", ")}</span>
            </p>
          )}
        </div>
        <div>
          <p className="mb-2 font-mono text-2xs font-bold tracking-wider text-muted uppercase">Log a substitution</p>
          <div className="grid grid-cols-[4.5rem_5rem_1fr] gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Inning
              <input
                type="number"
                min={1}
                max={20}
                value={draft.inning}
                onChange={(e) => setDraft((d) => ({ ...d, inning: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))}
                className={small}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Spot
              <select value={draft.spot} onChange={(e) => setDraft((d) => ({ ...d, spot: Number(e.target.value) }))} className={small}>
                {starters.map((_, i) => (
                  <option key={i} value={i + 1}>
                    {spotLabel(i + 1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Coming in
              <select value={draft.in} onChange={(e) => setDraft((d) => ({ ...d, in: e.target.value }))} className={small}>
                <option value="">Choose…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.short}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={!draft.in || pending}
            onClick={() => {
              save([...log, { ...draft }]);
              setDraft((d) => ({ ...d, in: "" }));
            }}
            className="mt-3 rounded-full border border-navy-600 px-4 py-1.5 text-sm font-semibold hover:border-pink hover:bg-pink hover:text-on-accent disabled:opacity-40"
          >
            Log it
          </button>
          {checks.length > 0 && (
            <ol className="mt-4 flex flex-col gap-1.5 text-sm">
              {checks.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-10 shrink-0 font-mono text-xs text-muted">Inn {c.entry.inning}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{name.get(c.entry.in)}</span> in for {name.get(c.out ?? "") ?? "–"} ({spotLabel(c.entry.spot)})
                    {c.reentry && <span className="ml-1 text-xs text-highlight">re-entry</span>}
                    {c.problem && <span className="block text-xs text-danger">{c.problem} Not counted.</span>}
                  </span>
                  <button type="button" onClick={() => save(log.filter((_, k) => k !== i))} aria-label="Remove this entry" className="text-xs text-muted hover:text-danger">
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
