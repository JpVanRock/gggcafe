"use client";

import { StatTerm } from "@/components/stat-term";
import { useActionState } from "react";
import { Field, FormMessage, buttonClass, fieldClass, inputClass } from "@/components/ui";
import { BASE_RUNNING, BASE_RUNNING_LABEL, HITTING_TYPES, HITTING_TYPE_LABEL, MAX_ROTATIONS, percent, rate } from "@/lib/gameday";
import { initialFormState } from "@/lib/form";
import { createLineup, saveGamedayCards } from "./actions";

export type CardPlayer = {
  id: string;
  short: string;
  positions: string[];
  hitting_type: string | null;
  base_running: string | null;
  statsFrom: "box" | "typed" | null;
  avg: number | null;
  obp: number | null;
  k_pct: number | null;
  typed: { avg: number | null; obp: number | null; k_pct: number | null };
};

const small = `${inputClass} px-2 py-1.5 text-sm`;
const stat = (n: number | null, k = false) => (n === null ? "" : k ? String(n) : n.toFixed(3).replace(/^0/, ""));

/** One row per player: hitting type, base running, and stats (typed only when there are no box scores). */
export function CardsForm({ teamId, seasonId, players }: { teamId: string; seasonId: string; players: CardPlayer[] }) {
  const [state, action, pending] = useActionState(saveGamedayCards, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="season_id" value={seasonId} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-700 text-[0.75rem] leading-4 font-semibold tracking-wider text-muted uppercase">
              <th className="py-2 pr-3">Player</th>
              <th className="py-2 pr-3">Hitting type</th>
              <th className="py-2 pr-3">Base running</th>
              <th className="py-2 pr-2">
                <StatTerm k="AVG" />
              </th>
              <th className="py-2 pr-2">
                <StatTerm k="OBP" />
              </th>
              <th className="py-2 pr-2">
                <StatTerm k="K%" />
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-navy-800">
                <td className="py-2 pr-3">
                  <input type="hidden" name="player_id" value={p.id} />
                  <span className="font-semibold">{p.short}</span>
                  {p.positions.length > 0 && <span className="ml-2 font-mono text-[10px] text-muted">{p.positions.join(" ")}</span>}
                </td>
                <td className="py-2 pr-3">
                  <select name="hitting_type" defaultValue={p.hitting_type ?? ""} aria-label={`Hitting type for ${p.short}`} className={small}>
                    <option value="">—</option>
                    {HITTING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {HITTING_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <select name="base_running" defaultValue={p.base_running ?? ""} aria-label={`Base running for ${p.short}`} className={small}>
                    <option value="">—</option>
                    {BASE_RUNNING.map((b) => (
                      <option key={b} value={b}>
                        {BASE_RUNNING_LABEL[b]}
                      </option>
                    ))}
                  </select>
                </td>
                {p.statsFrom === "box" ? (
                  <>
                    <td className="py-2 pr-2 font-display tabular-nums" title="From box scores">
                      {rate(p.avg)}
                      <input type="hidden" name="avg" value={stat(p.typed.avg)} />
                    </td>
                    <td className="py-2 pr-2 font-display tabular-nums" title="From box scores">
                      {rate(p.obp)}
                      <input type="hidden" name="obp" value={stat(p.typed.obp)} />
                    </td>
                    <td className="py-2 pr-2 font-display tabular-nums" title="From box scores">
                      {percent(p.k_pct)}
                      <input type="hidden" name="k_pct" value={stat(p.typed.k_pct, true)} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-2">
                      <input name="avg" defaultValue={stat(p.typed.avg)} inputMode="decimal" placeholder=".000" aria-label={`AVG for ${p.short}`} className={`${fieldClass} w-20 px-2 py-1.5 text-sm font-display tabular-nums`} />
                    </td>
                    <td className="py-2 pr-2">
                      <input name="obp" defaultValue={stat(p.typed.obp)} inputMode="decimal" placeholder=".000" aria-label={`OBP for ${p.short}`} className={`${fieldClass} w-20 px-2 py-1.5 text-sm font-display tabular-nums`} />
                    </td>
                    <td className="py-2 pr-2">
                      <input name="k_pct" defaultValue={stat(p.typed.k_pct, true)} inputMode="decimal" placeholder="0" aria-label={`K% for ${p.short}`} className={`${fieldClass} w-20 px-2 py-1.5 text-sm font-display tabular-nums`} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Stats fill in from box scores once games are entered. Until then, type them in (AVG and OBP like .312, K% like 18.5).</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save player cards"}
        </button>
        <FormMessage error={state.error} saved={state.saved} />
      </div>
    </form>
  );
}

export function NewLineupForm({
  teamId,
  seasonId,
  today,
  games,
}: {
  teamId: string;
  seasonId: string | null;
  today: string;
  games: { date: string; opponent: string }[];
}) {
  const [state, action, pending] = useActionState(createLineup, initialFormState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="team_id" value={teamId} />
      {seasonId && <input type="hidden" name="season_id" value={seasonId} />}
      <Field label="Game date">
        <input type="date" name="game_date" required defaultValue={games[0]?.date ?? today} className={inputClass} />
      </Field>
      <Field label="Opponent" hint={games.length ? "Upcoming games are suggested" : undefined}>
        <input name="opponent" list="gameday-opponents" maxLength={120} defaultValue={games[0]?.opponent ?? ""} placeholder="River City Blaze" className={inputClass} />
        <datalist id="gameday-opponents">
          {[...new Set(games.map((g) => g.opponent))].map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Field>
      <Field label="Title (optional)">
        <input name="title" maxLength={120} placeholder="Pool play, game 2" className={inputClass} />
      </Field>
      <Field label="Defensive rotations" hint="How many different alignments you'll use">
        <select name="rotations" defaultValue="5" className={inputClass}>
          {Array.from({ length: MAX_ROTATIONS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Setting up…" : "Start the lineup"}
        </button>
        <FormMessage error={state.error} />
      </div>
    </form>
  );
}
