"use client";

// The practice plan builder: setup, the drill library (drag drills in, or tap
// + Add), the timeline (drag to reorder; each drill gets a time limit, coaches
// and equipment) and the field (drag players from the roster to positions, or
// tap a player then a position). Changes save on their own a moment after you
// stop typing.
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, pointerWithin, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Card, inputClass, pillButtonClass, pillOutlineClass, sectionLabelClass } from "@/components/ui";
import { TOTAL_TIME_OPTIONS, durationLabel, finalizeProblems, planTimeline, type LibraryDrill, type PracticeSetting } from "@/lib/dugout";
import type { PlanBlock, PlanSpot, PracticePlan, RosterPlayer, StaffContact } from "@/lib/practice-plans";
import { SettingPills } from "../new-plan-form";
import { deletePracticePlan, finalizePracticePlan, savePracticePlan, sharePracticePlan } from "../actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatLongDate } from "@/lib/dates";
import { ShareButton } from "./share-button";
import { ActionForm } from "@/components/action-form";
import { labelClass, newKey, type Block, type Setup } from "./builder-shared";
import { LibraryPanel } from "./builder-library";
import { BlockCard, TimelineEnd } from "./builder-timeline";
import { FieldPlanner } from "./builder-field";

// ---------------------------------------------------------------------------
// The builder
// ---------------------------------------------------------------------------

export function PlanBuilder({
  plan,
  library,
  roster,
  coachNames,
  staff,
  emailReady,
}: {
  plan: PracticePlan;
  library: LibraryDrill[];
  roster: RosterPlayer[];
  coachNames: string[];
  staff: StaffContact[];
  emailReady: boolean;
}) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup>({
    practice_date: plan.practice_date,
    start_time: plan.start_time ?? "",
    setting: plan.setting,
    total_minutes: plan.total_minutes,
    location: plan.location ?? "",
    focus: plan.focus ?? "",
  });
  // stable keys for the saved drills (same on server and client); new ones get random keys
  const [blocks, setBlocks] = useState<Block[]>(() => plan.blocks.map((b, i) => ({ ...b, key: `saved-${i}` })));
  const [spots, setSpots] = useState<PlanSpot[]>(plan.spots);
  const [extraCoaches, setExtraCoaches] = useState<string[]>([]);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // --- autosave -------------------------------------------------------------
  const payload = useMemo(
    () =>
      JSON.stringify({
        ...setup,
        drills: blocks.map((b): PlanBlock => ({
          drill_id: b.drill_id, name: b.name, description: b.description, tags: b.tags,
          minutes: b.minutes, coaches: b.coaches, equipment: b.equipment, video_url: b.video_url,
        })),
        positions: spots,
      }),
    [setup, blocks, spots],
  );
  const [savedPayload, setSavedPayload] = useState(payload);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
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
        const res = await savePracticePlan(plan.id, body);
        if (res.error) {
          setSaveError(res.error);
          return false;
        }
        setSaveError(null);
        setSavedPayload(body);
        setSavedAt(res.savedAt ?? new Date().toISOString());
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

  /** Saves anything not yet saved; true when the server has the latest. */
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

  // --- blocks ---------------------------------------------------------------
  const addDrill = (drill: LibraryDrill, at = blocks.length) => {
    const key = newKey();
    const block: Block = {
      key,
      drill_id: drill.id,
      name: drill.name,
      description: drill.description,
      tags: drill.tags,
      minutes: null,
      coaches: [],
      equipment: drill.equipment,
      video_url: drill.video_url,
    };
    setBlocks((list) => [...list.slice(0, at), block, ...list.slice(at)]);
    setFocusKey(key);
  };
  const addCustom = (name: string) => {
    const key = newKey();
    setBlocks((list) => [...list, { key, drill_id: null, name, description: null, tags: [], minutes: null, coaches: [], equipment: null, video_url: null }]);
    setFocusKey(key);
  };
  const updateBlock = (key: string, patch: Partial<Block>) => setBlocks((list) => list.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  const coachOptions = useMemo(
    () => [...new Set([...coachNames, ...extraCoaches, ...blocks.flatMap((b) => b.coaches)])],
    [coachNames, extraCoaches, blocks],
  );

  // --- drag and drop (library → timeline, reorder) ---------------------------
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeDrag, setActiveDrag] = useState<{ kind: "lib"; drill: LibraryDrill } | { kind: "block"; key: string } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const collision: CollisionDetection = (args) => {
    if (String(args.active.id).startsWith("lib:")) {
      const hits = pointerWithin(args);
      const block = hits.find((h) => h.id !== "timeline-end");
      return block ? [block] : hits;
    }
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => c.id !== "timeline-end") });
  };

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith("lib:")) setActiveDrag({ kind: "lib", drill: (e.active.data.current as { drill: LibraryDrill }).drill });
    else setActiveDrag({ kind: "block", key: id });
  }
  function onDragOver(e: DragOverEvent) {
    setOverId(e.over ? String(e.over.id) : null);
  }
  function onDragEnd(e: DragEndEvent) {
    const drag = activeDrag;
    setActiveDrag(null);
    setOverId(null);
    const over = e.over ? String(e.over.id) : null;
    if (!drag || !over) return;
    if (drag.kind === "lib") {
      const at = over === "timeline-end" ? blocks.length : blocks.findIndex((b) => b.key === over);
      addDrill(drag.drill, at < 0 ? blocks.length : at);
    } else if (over !== drag.key) {
      const from = blocks.findIndex((b) => b.key === drag.key);
      const to = blocks.findIndex((b) => b.key === over);
      if (from >= 0 && to >= 0) setBlocks((list) => arrayMove(list, from, to));
    }
  }

  // --- finalize -------------------------------------------------------------
  const { slots, used } = planTimeline(setup.start_time, blocks);
  const open = setup.total_minutes - used;
  const problems = finalizeProblems(blocks);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function finalizeAndPrint() {
    // open the tab during the click so pop-up blockers allow it
    const tab = window.open("", "_blank");
    if (tab) tab.document.title = "Preparing practice plan…";
    setBusy(true);
    setActionError(null);
    try {
      if (!(await flush())) {
        tab?.close();
        setActionError("Couldn't save your latest changes. Check your connection and try again.");
        return;
      }
      const res = await finalizePracticePlan(plan.id);
      if (res.error) {
        tab?.close();
        setActionError(res.error);
        return;
      }
      const url = `/dugout/plans/${plan.id}/pdf`;
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

  const status = saveError ? (
    <span className="text-danger">{saveError}</span>
  ) : saving ? (
    "Saving…"
  ) : dirty ? (
    "Unsaved changes"
  ) : savedAt ? (
    `Saved ${new Date(savedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
  ) : (
    "All changes saved"
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{plan.team.name} · Practice plan</p>
          <h2 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">
            {formatLongDate(setup.practice_date)}
          </h2>
        </div>
        <span className="rounded border border-pink px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-pink-soft uppercase">
          Draft
        </span>
      </header>

      {/* Setup */}
      <Card title="Practice setup" actions={<span className="text-xs text-muted" aria-live="polite">{status}</span>}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <fieldset>
            <legend className={`${labelClass} mb-1.5`}>Indoor or outdoor</legend>
            <SettingPills name="setting" value={setup.setting} onChange={(v) => setSetup((s) => ({ ...s, setting: v as PracticeSetting }))} />
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Total practice time</span>
            <select
              value={setup.total_minutes}
              onChange={(e) => setSetup((s) => ({ ...s, total_minutes: Number(e.target.value) }))}
              className={inputClass}
            >
              {[...new Set([...TOTAL_TIME_OPTIONS, setup.total_minutes])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {durationLabel(m)}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Date</span>
            <input
              type="date"
              required
              value={setup.practice_date}
              onChange={(e) => e.target.value && setSetup((s) => ({ ...s, practice_date: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Start time</span>
            <input type="time" step={300} value={setup.start_time} onChange={(e) => setSetup((s) => ({ ...s, start_time: e.target.value }))} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Location</span>
            <input value={setup.location} maxLength={120} onChange={(e) => setSetup((s) => ({ ...s, location: e.target.value }))} placeholder="Field 2" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Focus</span>
            <input value={setup.focus} maxLength={200} onChange={(e) => setSetup((s) => ({ ...s, focus: e.target.value }))} placeholder="Defense and relays" className={inputClass} />
          </label>
        </div>
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="font-display text-lg font-bold text-highlight tabular-nums">{used}</span>
              <span className="text-muted"> of {setup.total_minutes} min planned</span>
            </span>
            <span className={open < 0 ? "font-semibold text-danger" : "text-muted"}>
              {open > 0 ? `${open} min open` : open < 0 ? `Over by ${-open} min` : "Right on time"}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-800" aria-hidden>
            <div
              className={`h-full rounded-full transition-all ${open < 0 ? "bg-danger" : "bg-neon"}`}
              style={{ width: `${Math.min(100, (used / setup.total_minutes) * 100)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Library + timeline */}
      <DndContext
        id="plan-drills"
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveDrag(null);
          setOverId(null);
        }}
      >
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
          <div className="lg:sticky lg:top-20">
            <LibraryPanel library={library} onAdd={(d) => addDrill(d)} onAddCustom={addCustom} />
          </div>
          <section aria-label="Practice timeline">
            <h2 className={`${sectionLabelClass} mb-3`}>Practice timeline</h2>
            <SortableContext items={blocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-3">
                {blocks.map((b, i) => (
                  <BlockCard
                    key={b.key}
                    block={b}
                    index={i}
                    slotLabel={slots[i].label}
                    coachOptions={coachOptions}
                    onChange={(patch) => updateBlock(b.key, patch)}
                    onRemove={() => setBlocks((list) => list.filter((x) => x.key !== b.key))}
                    onNewCoach={(name) => setExtraCoaches((list) => (list.includes(name) ? list : [...list, name]))}
                    showDropLine={activeDrag?.kind === "lib" && overId === b.key}
                    focusMinutes={focusKey === b.key}
                  />
                ))}
                <TimelineEnd empty={blocks.length === 0} active={activeDrag?.kind === "lib" && overId === "timeline-end"} />
              </ol>
            </SortableContext>
          </section>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="max-w-xs rounded-lg border border-pink bg-navy-900 px-3 py-2 text-sm font-semibold shadow-2xl">
              {activeDrag.kind === "lib" ? activeDrag.drill.name : blocks.find((b) => b.key === activeDrag.key)?.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Field */}
      <Card title="Positions">
        <FieldPlanner roster={roster} spots={spots} onChange={setSpots} />
      </Card>

      {/* Finalize */}
      <section aria-label="Finalize" className="flex flex-col gap-3 rounded-2xl border border-navy-700 bg-navy-900/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={finalizeAndPrint} disabled={busy || problems.length > 0} className={pillButtonClass}>
            {busy ? "Finalizing…" : "Finalize & Print"}
          </button>
          <ShareButton
            planId={plan.id}
            action={sharePracticePlan}
            returnPath={`/dugout/plans/${plan.id}`}
            staff={staff}
            label="Finalize & Share"
            className={pillOutlineClass}
            disabled={busy || problems.length > 0}
            emailReady={emailReady}
            beforeSend={flush}
          />
          <span className="text-xs text-muted">Print opens the PDF. Share emails it to the coaching staff.</span>
          <ActionForm action={deletePracticePlan} className="ml-auto">
            <input type="hidden" name="id" value={plan.id} />
            <input type="hidden" name="team_id" value={plan.team.id} />
            <ConfirmSubmit message="Delete this draft practice plan? This can't be undone." className="text-xs text-danger hover:underline">
              Delete draft
            </ConfirmSubmit>
          </ActionForm>
        </div>
        {problems.length > 0 && (
          <ul className="text-sm text-pink-soft">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {actionError && <p className="text-sm text-danger">{actionError}</p>}
      </section>
    </div>
  );
}
