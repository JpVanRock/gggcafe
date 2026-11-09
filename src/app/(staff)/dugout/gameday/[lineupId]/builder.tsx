"use client";

// The lineup builder: batting order (drag to reorder, add from the bench),
// defensive rotations (a spot for every player in each rotation, with checks
// for missing or doubled positions) and the pitching plan for each rotation.
// Saves on its own a moment after a change.
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, fieldClass, inputClass, pillButtonClass, pillOutlineClass, sectionLabelClass } from "@/components/ui";
import { formatLongDate } from "@/lib/dates";
import {
  BASE_RUNNING_LABEL, GAME_JOB_STARTERS, HITTING_TYPE_LABEL, MAX_ROTATIONS, PITCHES, ROTATION_SPOTS, dpFlexProblems, fieldingPlayers, percent,
  pitcherOf, rate, rotationProblems,
  type GameJob, type Pitch, type PitchPlan, type Rotation, type RotationSpot,
} from "@/lib/gameday";
import type { GamedayPlayer, Lineup } from "@/lib/gameday-data";
import { suggestDefense, type DepthChart } from "@/lib/playbook";
import type { StaffContact } from "@/lib/practice-plans";
import { ShareButton } from "../../plans/[planId]/share-button";
import { deleteLineup, finalizeLineup, saveLineup, shareLineup } from "../actions";
import { ActionForm } from "@/components/action-form";

const labelClass = "font-mono text-[10px] font-bold tracking-wider text-muted uppercase";
const small = `${inputClass} px-2 py-1 text-sm`;

function Grip() {
  return (
    <svg viewBox="0 0 12 18" aria-hidden className="h-4 w-3" fill="currentColor">
      {[3, 9].map((x) => [3, 9, 15].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.5" />))}
    </svg>
  );
}

function OrderRow({ player, slot, onRemove }: { player: GamedayPlayer | undefined; slot: number; onRemove: () => void }) {
  const id = player?.id ?? `missing-${slot}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 ${isDragging ? "z-10 opacity-60" : ""}`}
    >
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Move ${player?.name ?? "player"}`} className="cursor-grab touch-none rounded p-1 text-muted hover:bg-navy-800">
        <Grip />
      </button>
      <span className="w-6 font-display text-lg font-bold text-highlight tabular-nums">{slot}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{player?.short ?? "Player no longer on the roster"}</p>
        <p className="truncate text-xs text-muted">
          {[player?.hitting_type && HITTING_TYPE_LABEL[player.hitting_type], player?.base_running && BASE_RUNNING_LABEL[player.base_running]]
            .filter(Boolean)
            .join(" · ") || "No player card yet"}
        </p>
      </div>
      <span className="hidden font-display text-xs text-muted tabular-nums sm:block">
        {rate(player?.avg)} / {rate(player?.obp)} · K {percent(player?.k_pct)}
      </span>
      <button type="button" onClick={onRemove} aria-label={`Take ${player?.name ?? "player"} out of the order`} className="rounded px-2 text-muted hover:text-danger">
        ✕
      </button>
    </li>
  );
}

export function LineupBuilder({
  lineup,
  roster,
  staff,
  emailReady,
  depth = {},
  dutyJobs = [],
}: {
  lineup: Lineup;
  roster: GamedayPlayer[];
  staff: StaffContact[];
  emailReady: boolean;
  /** the team's depth chart (GameDay → Depth chart), to fill a rotation from */
  depth?: DepthChart;
  /** "during the game" jobs from the staff duty matrix, to fill the jobs from */
  dutyJobs?: GameJob[];
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const [setup, setSetup] = useState({
    game_date: lineup.game_date,
    opponent: lineup.opponent ?? "",
    title: lineup.title ?? "",
    rotations: lineup.rotations,
    notes: lineup.notes ?? "",
  });
  const [order, setOrder] = useState<string[]>(lineup.batting_order);
  const [defense, setDefense] = useState<Record<string, Rotation>>(lineup.defense ?? {});
  const [pitching, setPitching] = useState<Record<string, PitchPlan>>(lineup.pitching ?? {});
  const [dpFlex, setDpFlex] = useState<{ dp: string | null; flex: string | null }>({ dp: lineup.dp_player_id, flex: lineup.flex_player_id });
  const [jobs, setJobs] = useState<GameJob[]>(lineup.jobs ?? []);
  const rotations = Array.from({ length: setup.rotations }, (_, i) => String(i + 1));

  // --- autosave -------------------------------------------------------------
  const payload = useMemo(
    () => JSON.stringify({ ...setup, batting_order: order, defense, pitching, dp_player_id: dpFlex.dp, flex_player_id: dpFlex.flex, jobs }),
    [setup, order, defense, pitching, dpFlex, jobs],
  );
  const [savedPayload, setSavedPayload] = useState(payload);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const latest = useRef(payload);
  useEffect(() => {
    latest.current = payload;
  }, [payload]);
  const dirty = payload !== savedPayload;

  function persist(body: string) {
    const run = chain.current.then(async () => {
      setSaving(true);
      try {
        const res = await saveLineup(lineup.id, body);
        if (res.error) {
          setSaveError(res.error);
          return false;
        }
        setSaveError(null);
        setSavedPayload(body);
        return true;
      } catch {
        setSaveError("Couldn't reach the server. Your changes will save when you're back online.");
        return false;
      } finally {
        setSaving(false);
      }
    });
    chain.current = run.catch(() => false);
    return run;
  }
  const autosave = useEffectEvent(() => void persist(latest.current));
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(autosave, 900);
    return () => clearTimeout(t);
  }, [payload, dirty]);
  async function flush() {
    const ok = await chain.current;
    if (latest.current === savedPayload && ok) return true;
    return persist(latest.current);
  }
  const warnOnLeave = dirty || saving;
  useEffect(() => {
    if (!warnOnLeave) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [warnOnLeave]);

  // --- batting order ----------------------------------------------------------
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setOrder((list) => arrayMove(list, list.indexOf(String(e.active.id)), list.indexOf(String(e.over!.id))));
  }
  const bench = roster.filter((p) => !order.includes(p.id));

  // --- defense ----------------------------------------------------------------
  const setSpot = (rot: string, playerId: string, spot: string) =>
    setDefense((d) => {
      const next = { ...(d[rot] ?? {}) };
      if (spot) next[playerId] = spot as RotationSpot;
      else delete next[playerId];
      return { ...d, [rot]: next };
    });
  const copyRotation = (from: string, to: string) => setDefense((d) => ({ ...d, [to]: { ...(d[from] ?? {}) } }));
  const defenseRows = [...order.filter((id) => byId.has(id)), ...bench.map((p) => p.id)];
  const hasDepth = Object.values(depth).some((list) => list && list.length > 0);
  // The batting order plays the field; with nobody in the order yet, use everyone.
  const fromDepth = (rot: string) => {
    const inGame = order.filter((id) => byId.has(id));
    setDefense((d) => ({ ...d, [rot]: suggestDefense(depth, inGame.length ? fieldingPlayers(inGame, dpFlex.dp, dpFlex.flex) : defenseRows) }));
  };

  // --- pitching ---------------------------------------------------------------
  const setPitch = (rot: string, patch: Partial<PitchPlan>) =>
    setPitching((p) => {
      const base: PitchPlan = p[rot] ?? { primary: null, secondary: null, chase: [] };
      return { ...p, [rot]: { ...base, ...patch } };
    });

  // --- finalize ---------------------------------------------------------------
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  async function finalizeAndPrint() {
    const tab = window.open("", "_blank");
    if (tab) tab.document.title = "Preparing lineup…";
    setBusy(true);
    setActionError(null);
    try {
      if (!(await flush())) {
        tab?.close();
        setActionError("Couldn't save your latest changes. Check your connection and try again.");
        return;
      }
      const res = await finalizeLineup(lineup.id);
      if (res.error) {
        tab?.close();
        setActionError(res.error);
        return;
      }
      const url = `/dugout/gameday/${lineup.id}/pdf`;
      if (tab) {
        tab.location.href = url;
        router.refresh();
      } else {
        // the new tab was blocked: open the PDF (a file, not a page) in this tab
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(url);
      }
    } catch {
      tab?.close();
      setActionError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  const problems = [...(order.length === 0 ? ["Add players to the batting order."] : []), ...dpFlexProblems(order, dpFlex.dp, dpFlex.flex)];
  const setJob = (i: number, patch: Partial<GameJob>) => setJobs((list) => list.map((j, k) => (k === i ? { ...j, ...patch } : j)));

  const status = saveError ? <span className="text-danger">{saveError}</span> : saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{lineup.team.name} · Lineup</p>
          <h2 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">
            {setup.opponent ? `vs ${setup.opponent}` : formatLongDate(setup.game_date)}
          </h2>
          {setup.opponent && <p className="mt-1 text-sm text-muted">{formatLongDate(setup.game_date)}</p>}
        </div>
        <span className="text-xs text-muted" aria-live="polite">
          {status}
        </span>
      </header>

      <Card title="Game">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Date</span>
            <input type="date" value={setup.game_date} onChange={(e) => e.target.value && setSetup((s) => ({ ...s, game_date: e.target.value }))} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Opponent</span>
            <input value={setup.opponent} maxLength={120} onChange={(e) => setSetup((s) => ({ ...s, opponent: e.target.value }))} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Title</span>
            <input value={setup.title} maxLength={120} onChange={(e) => setSetup((s) => ({ ...s, title: e.target.value }))} placeholder="Pool play, game 2" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Defensive rotations</span>
            <select value={setup.rotations} onChange={(e) => setSetup((s) => ({ ...s, rotations: Number(e.target.value) }))} className={inputClass}>
              {Array.from({ length: MAX_ROTATIONS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {/* Batting order */}
      <section aria-label="Batting order" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div>
          <h2 className={`${sectionLabelClass} mb-3`}>Batting order ({order.length})</h2>
          <DndContext id="lineup-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-2">
                {order.map((id, i) => (
                  <OrderRow key={id} player={byId.get(id)} slot={i + 1} onRemove={() => setOrder((list) => list.filter((x) => x !== id))} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          {order.length === 0 && (
            <p className="rounded-xl border-2 border-dashed border-navy-700 p-8 text-center text-sm text-muted">Add players from the bench to build the order.</p>
          )}
        </div>
        <Card
          title={`Bench (${bench.length})`}
          actions={
            bench.length > 0 ? (
              <button type="button" onClick={() => setOrder((list) => [...list, ...bench.map((p) => p.id)])} className="text-xs font-semibold text-pink hover:underline">
                Add everyone
              </button>
            ) : undefined
          }
        >
          {bench.length === 0 ? (
            <p className="text-sm text-muted">Everyone is in the order.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {bench.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-navy-700 px-2.5 py-1.5 text-sm">
                  <span className="truncate">{p.short}</span>
                  <button
                    type="button"
                    onClick={() => setOrder((list) => [...list, p.id])}
                    className="shrink-0 rounded-full border border-navy-600 px-2.5 py-0.5 text-xs font-semibold hover:border-pink hover:bg-pink hover:text-on-accent"
                  >
                    + Bat {order.length + 1}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* DP / FLEX */}
      <Card title="DP / FLEX">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>DP (bats, doesn&apos;t have to field)</span>
            <select value={dpFlex.dp ?? ""} onChange={(e) => setDpFlex((d) => ({ ...d, dp: e.target.value || null }))} className={inputClass}>
              <option value="">Not using DP/FLEX</option>
              {order.filter((id) => byId.has(id)).map((id) => (
                <option key={id} value={id}>
                  {byId.get(id)!.short}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>FLEX (plays defense, doesn&apos;t bat)</span>
            <select value={dpFlex.flex ?? ""} onChange={(e) => setDpFlex((d) => ({ ...d, flex: e.target.value || null }))} className={inputClass}>
              <option value="">—</option>
              {bench.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.short}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">The FLEX goes on the card as the extra line after the batting order. In the rotations, the FLEX fields and the DP can sit.</p>
      </Card>

      {/* Defensive rotations */}
      <Card title="Defensive rotations">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-navy-700">
                <th className="py-2 pr-3 text-[0.75rem] leading-4 font-semibold tracking-wider text-muted uppercase">Player</th>
                {rotations.map((r, i) => {
                  const p = rotationProblems(defense[r]);
                  const ok = p.missing.length === 0 && p.doubled.length === 0;
                  return (
                    <th key={r} className="px-1 py-2 align-bottom">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-display text-sm font-bold text-highlight">R{r}</span>
                        <span
                          className={`text-[10px] font-semibold ${ok ? "text-highlight" : "text-pink-soft"}`}
                          title={ok ? "Every position filled once" : [p.missing.length && `Missing ${p.missing.join(", ")}`, p.doubled.length && `Two at ${p.doubled.join(", ")}`].filter(Boolean).join(" · ")}
                        >
                          {ok ? "✓ Set" : p.doubled.length ? `2× ${p.doubled[0]}` : `${p.missing.length} open`}
                        </span>
                        {i > 0 && (
                          <button type="button" onClick={() => copyRotation(rotations[i - 1], r)} className="text-[10px] text-muted hover:text-pink" title={`Copy R${rotations[i - 1]} into R${r}`}>
                            Copy R{rotations[i - 1]}
                          </button>
                        )}
                        {hasDepth && (
                          <button type="button" onClick={() => fromDepth(r)} className="text-[10px] text-muted hover:text-pink" title={`Fill R${r} from the depth chart`}>
                            Depth chart
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {defenseRows.map((id) => {
                const p = byId.get(id)!;
                return (
                  <tr key={id} className="border-b border-navy-800">
                    <td className="py-1.5 pr-3">
                      <span className="font-semibold">{p.short}</span>
                      {p.positions.length > 0 && <span className="ml-1.5 font-mono text-[10px] text-muted">{p.positions.slice(0, 3).join(" ")}</span>}
                    </td>
                    {rotations.map((r) => {
                      const spot = defense[r]?.[id] ?? "";
                      return (
                        <td key={r} className="px-1 py-1.5 text-center">
                          <select
                            value={spot}
                            onChange={(e) => setSpot(r, id, e.target.value)}
                            aria-label={`${p.name}, rotation ${r}`}
                            className={`${fieldClass} w-[4.5rem] px-2 py-1 text-sm text-center ${spot === "P" ? "border-pink font-bold" : ""}`}
                          >
                            <option value="">—</option>
                            {ROTATION_SPOTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Each rotation needs one player at every position. Sub means she sits that rotation. The player at P pitches that rotation.</p>
      </Card>

      {/* Pitching plan */}
      <Card title="Pitching plan">
        <ul className="flex flex-col gap-3">
          {rotations.map((r) => {
            const pitcher = pitcherOf(defense[r]);
            const plan = pitching[r] ?? { primary: null, secondary: null, chase: [] };
            const pitchSelect = (value: Pitch | null, onChange: (v: Pitch | null) => void, label: string) => (
              <label className="flex flex-col gap-1">
                <span className={labelClass}>{label}</span>
                <select value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as Pitch | null)} className={small}>
                  <option value="">—</option>
                  {PITCHES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            );
            return (
              <li key={r} className="rounded-xl border border-navy-700 bg-navy-950/40 p-3">
                <p className="mb-2 text-sm">
                  <span className="font-display font-bold text-highlight">R{r}</span>
                  <span className="ml-2 font-semibold">{pitcher ? byId.get(pitcher)?.short : <span className="text-pink-soft">No pitcher yet: set someone to P in R{r}</span>}</span>
                </p>
                <div className="grid gap-3 sm:grid-cols-5">
                  {pitchSelect(plan.primary, (v) => setPitch(r, { primary: v }), "Primary")}
                  {pitchSelect(plan.secondary, (v) => setPitch(r, { secondary: v }), "Secondary")}
                  {[0, 1, 2].map((i) =>
                    <div key={i}>
                      {pitchSelect(plan.chase[i] ?? null, (v) => {
                        const chase = [...plan.chase];
                        chase[i] = v as Pitch;
                        setPitch(r, { chase: chase.filter(Boolean) });
                      }, `Chase ${i + 1}`)}
                    </div>,
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card
        title="Game-day jobs"
        actions={
          dutyJobs.length > 0 ? (
            <button type="button" onClick={() => setJobs(dutyJobs.slice(0, 12))} className="text-xs font-semibold text-pink hover:underline">
              Fill from staff duties
            </button>
          ) : undefined
        }
      >
        {jobs.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {jobs.map((j, i) => (
              <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <input value={j.job} maxLength={40} onChange={(e) => setJob(i, { job: e.target.value })} aria-label="Job" list="game-jobs" className={small} />
                <input value={j.who} maxLength={60} onChange={(e) => setJob(i, { who: e.target.value })} aria-label="Who" placeholder="Coach or parent" className={small} />
                <button type="button" onClick={() => setJobs((list) => list.filter((_, k) => k !== i))} aria-label="Remove job" className="rounded px-2 text-muted hover:text-danger">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <datalist id="game-jobs">
          {GAME_JOB_STARTERS.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        {jobs.length < 12 && (
          <button type="button" onClick={() => setJobs((list) => [...list, { job: GAME_JOB_STARTERS[list.length % GAME_JOB_STARTERS.length], who: "" }])} className="text-sm font-semibold text-pink-soft hover:underline">
            + Add a job
          </button>
        )}
        <p className="mt-2 text-xs text-muted">Printed on the lineup card. Parents can take a job too (keep the book, video).</p>
      </Card>

      <Card title="Notes">
        <textarea
          value={setup.notes}
          maxLength={1000}
          rows={3}
          onChange={(e) => setSetup((s) => ({ ...s, notes: e.target.value }))}
          placeholder="Matchups, reminders"
          className={inputClass}
        />
      </Card>

      <section aria-label="Finalize" className="flex flex-col gap-3 rounded-2xl border border-navy-700 bg-navy-900/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={finalizeAndPrint} disabled={busy || problems.length > 0} className={pillButtonClass}>
            {busy ? "Finalizing…" : "Finalize & Print"}
          </button>
          <ShareButton
            planId={lineup.id}
            action={shareLineup}
            returnPath={`/dugout/gameday/${lineup.id}`}
            staff={staff}
            label="Finalize & Share"
            className={pillOutlineClass}
            disabled={busy || problems.length > 0}
            emailReady={emailReady}
            beforeSend={flush}
          />
          <span className="text-xs text-muted">Print opens the lineup card PDF. Share emails it to the coaching staff.</span>
          <ActionForm action={deleteLineup} className="ml-auto">
            <input type="hidden" name="id" value={lineup.id} />
            <input type="hidden" name="team_id" value={lineup.team.id} />
            <ConfirmSubmit message="Delete this draft lineup? This can't be undone." className="text-xs text-danger hover:underline">
              Delete draft
            </ConfirmSubmit>
          </ActionForm>
        </div>
        {problems.map((p) => (
          <p key={p} className="text-sm text-pink-soft">
            {p}
          </p>
        ))}
        {actionError && <p className="text-sm text-danger">{actionError}</p>}
      </section>
    </div>
  );
}
