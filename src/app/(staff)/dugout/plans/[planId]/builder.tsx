"use client";

// The practice plan builder: setup, the drill library (drag drills in, or tap
// + Add), the timeline (drag to reorder; each drill gets a time limit, coaches
// and equipment) and the field (drag players from the roster to positions, or
// tap a player then a position). Changes save on their own a moment after you
// stop typing.
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, pointerWithin, useDraggable,
  useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { DrillTags } from "@/components/drill-tags";
import { FieldFrame, PositionBadge, spotStyle } from "@/components/practice-field";
import { Card, EmptyState, inputClass, pillButtonClass, pillOutlineClass, sectionLabelClass } from "@/components/ui";
import {
  MAX_BLOCK_MINUTES, PLAN_POSITIONS, TOTAL_TIME_OPTIONS, durationLabel, filterDrills, finalizeProblems, planTimeline,
  type DrillTag, type LibraryDrill, type PlanPosition, type PracticeSetting,
} from "@/lib/dugout";
import type { PlanBlock, PlanSpot, PracticePlan, RosterPlayer, StaffContact } from "@/lib/practice-plans";
import { TagFilter } from "../../drills/library";
import { SettingPills } from "../new-plan-form";
import { deletePracticePlan, finalizePracticePlan, savePracticePlan, sharePracticePlan } from "../actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatLongDate } from "@/lib/dates";
import { ShareButton } from "./share-button";

type Block = PlanBlock & { key: string };
type Setup = {
  practice_date: string;
  start_time: string;
  setting: PracticeSetting;
  total_minutes: number;
  location: string;
  focus: string;
};

/** Key for a block added in the browser (only called from event handlers). */
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

const chip = "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition";
const labelClass = "font-mono text-[10px] font-bold tracking-wider text-muted uppercase";

function GripIcon() {
  return (
    <svg viewBox="0 0 12 18" aria-hidden className="h-4 w-3" fill="currentColor">
      {[3, 9].map((x) => [3, 9, 15].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.5" />))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

function LibraryItem({ drill, onAdd }: { drill: LibraryDrill; onAdd: () => void }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: `lib:${drill.id}`, data: { drill } });
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      className={`flex cursor-grab items-start gap-2 rounded-lg border border-navy-700 bg-navy-950/50 p-2.5 touch-manipulation hover:border-pink/70 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span className="mt-0.5 text-muted">
        <GripIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-semibold">{drill.name}</p>
        <DrillTags tags={drill.tags} className="mt-1" />
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="shrink-0 rounded-full border border-navy-600 px-2.5 py-0.5 text-xs font-semibold text-ink hover:border-pink hover:bg-pink hover:text-on-accent"
        aria-label={`Add ${drill.name} to the plan`}
      >
        + Add
      </button>
    </li>
  );
}

function LibraryPanel({
  library,
  onAdd,
  onAddCustom,
}: {
  library: LibraryDrill[];
  onAdd: (drill: LibraryDrill) => void;
  onAddCustom: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<DrillTag | "all">("all");
  const [custom, setCustom] = useState("");
  const shown = filterDrills(library, search, tag);

  return (
    <Card title="Drill Library">
      <p className="mb-3 text-xs text-muted">Drag a drill into the plan, or tap + Add.</p>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search drills"
        aria-label="Search drills"
        className={`${inputClass} mb-3 text-sm`}
      />
      <TagFilter drills={library} value={tag} onChange={setTag} />
      {library.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          The library is empty.{" "}
          <a href="/dugout/drills" className="text-pink hover:underline">
            Add drills →
          </a>
        </p>
      ) : (
        <ul className="mt-3 flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
          {shown.map((d) => (
            <LibraryItem key={d.id} drill={d} onAdd={() => onAdd(d)} />
          ))}
          {shown.length === 0 && <li className="text-sm text-muted">No drills match.</li>}
        </ul>
      )}
      <form
        className="mt-4 border-t border-navy-700 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) onAddCustom(custom.trim());
          setCustom("");
        }}
      >
        <p className={`${labelClass} mb-2`}>Add a block that isn&apos;t a drill</p>
        <div className="flex flex-wrap gap-2">
          {["Water break", "Team talk"].map((name) => (
            <button key={name} type="button" onClick={() => onAddCustom(name)} className={`${chip} border-navy-600 text-muted hover:border-pink hover:text-ink`}>
              + {name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={120}
            placeholder="Other (e.g. Scrimmage)"
            aria-label="Custom block name"
            className={`${inputClass} text-sm`}
          />
          <button type="submit" className={`${chip} shrink-0 border-navy-600 hover:border-pink`}>
            Add
          </button>
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function CoachPicker({
  value,
  options,
  onChange,
  onNewCoach,
  drillName,
}: {
  value: string[];
  options: string[];
  onChange: (coaches: string[]) => void;
  onNewCoach: (name: string) => void;
  drillName: string;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  const add = () => {
    const n = name.trim();
    if (n) {
      onNewCoach(n);
      if (!value.includes(n)) onChange([...value, n]);
    }
    setName("");
    setAdding(false);
  };

  return (
    <div role="group" aria-label={`Coaches for ${drillName}`} className="flex flex-wrap items-center gap-1.5">
      {all.map((c) => {
        const on = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(c)}
            className={`${chip} ${on ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"}`}
          >
            {c}
          </button>
        );
      })}
      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={add}
            maxLength={60}
            placeholder="Coach name"
            aria-label="New coach name"
            className="w-32 rounded-full border border-navy-600 bg-navy-950 px-2.5 py-0.5 text-xs outline-none focus:border-pink"
          />
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${chip} border-dashed border-navy-600 text-muted hover:border-pink hover:text-ink`}>
          + Coach
        </button>
      )}
    </div>
  );
}

function BlockCard({
  block,
  index,
  slotLabel,
  coachOptions,
  onChange,
  onRemove,
  onNewCoach,
  showDropLine,
  focusMinutes,
}: {
  block: Block;
  index: number;
  slotLabel: string | null;
  coachOptions: string[];
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onNewCoach: (name: string) => void;
  showDropLine: boolean;
  focusMinutes: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.key });
  const minutesRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusMinutes) {
      minutesRef.current?.focus({ preventScroll: true });
      minutesRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusMinutes]);
  const missing = !block.minutes;
  const isDrill = Boolean(block.drill_id) || block.tags.length > 0;

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={`relative ${isDragging ? "z-10 opacity-60" : ""}`}>
      {showDropLine && <span aria-hidden className="absolute inset-x-0 -top-2 h-0.5 rounded-full bg-pink" />}
      <article className={`rounded-xl border bg-navy-900 p-3 sm:p-4 ${missing ? "border-pink/70" : "border-navy-600"}`}>
        <div className="flex items-start gap-3">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Move ${block.name}`}
            className="mt-1 cursor-grab touch-none rounded p-1 text-muted hover:bg-navy-800 hover:text-ink"
          >
            <GripIcon />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs tracking-wider text-pink-soft">
              <span className="font-display font-bold text-highlight tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              {"  ·  "}
              {slotLabel ?? "Set a time limit"}
            </p>
            <p className="mt-0.5 text-base leading-snug font-semibold">{block.name}</p>
            <DrillTags tags={block.tags} className="mt-1" />
            {block.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted" title={block.description}>{block.description}</p>}
            {block.video_url && (
              <a href={block.video_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-pink hover:underline">
                ▶ Watch the drill
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${block.name}`}
            className="rounded-md border border-navy-600 px-2 py-0.5 text-sm text-muted hover:border-pink hover:text-danger"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-x-5 sm:pl-9">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Time limit</span>
            <span className="flex items-center gap-1.5">
              <input
                ref={minutesRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_BLOCK_MINUTES}
                value={block.minutes ?? ""}
                onChange={(e) => {
                  const n = e.target.value === "" ? null : Math.round(Number(e.target.value));
                  onChange({ minutes: n === null || Number.isNaN(n) ? null : Math.min(MAX_BLOCK_MINUTES, Math.max(1, n)) });
                }}
                aria-invalid={missing}
                aria-label={`Minutes for ${block.name}`}
                className={`w-20 rounded-md border bg-navy-950 px-2 py-1.5 text-center font-display font-semibold tabular-nums outline-none focus:border-pink focus:ring-2 focus:ring-pink/30 ${
                  missing ? "border-pink" : "border-navy-600"
                }`}
              />
              <span className="text-sm text-muted">min</span>
            </span>
          </label>
          <div className="flex flex-col gap-1">
            <span className={labelClass}>
              Coach{isDrill && block.coaches.length === 0 && <span className="ml-1.5 text-pink-soft normal-case">· assign one</span>}
            </span>
            <CoachPicker
              value={block.coaches}
              options={coachOptions}
              onChange={(coaches) => onChange({ coaches })}
              onNewCoach={onNewCoach}
              drillName={block.name}
            />
          </div>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClass}>Equipment (if needed)</span>
            <input
              value={block.equipment ?? ""}
              onChange={(e) => onChange({ equipment: e.target.value || null })}
              maxLength={500}
              placeholder="Cones, bucket of balls"
              className={`${inputClass} py-1.5 text-sm`}
            />
          </label>
        </div>
      </article>
    </li>
  );
}

function TimelineEnd({ empty, active }: { empty: boolean; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "timeline-end" });
  return (
    <li
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed p-5 text-center text-sm transition ${
        isOver || active ? "border-pink bg-pink/10 text-ink" : "border-navy-700 text-muted"
      } ${empty ? "py-12" : ""}`}
    >
      {empty ? "Drag drills here to build the practice" : "Drop here to add at the end"}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

function RosterChip({ player, count, selected, onTap }: { player: RosterPlayer; count: number; selected: boolean; onTap: () => void }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: `roster:${player.id}`, data: { playerId: player.id } });
  return (
    <li>
      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        onClick={onTap}
        aria-pressed={selected}
        className={`flex w-full cursor-grab items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm touch-manipulation transition ${
          selected ? "border-pink bg-pink/15" : "border-navy-700 bg-navy-950/50 hover:border-pink/70"
        } ${isDragging ? "opacity-40" : ""}`}
      >
        <span className="w-8 shrink-0 font-display font-bold text-highlight tabular-nums">{player.number ? `#${player.number}` : "–"}</span>
        <span className="min-w-0 flex-1 truncate">{player.name}</span>
        {player.primary && <span className="font-mono text-[10px] text-muted">{player.primary}</span>}
        {count > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-neon px-1 font-mono text-[10px] font-bold text-on-accent" title="Placed on the field">
            {count}
          </span>
        )}
      </button>
    </li>
  );
}

function PlacedChip({ position, player, onRemove }: { position: PlanPosition; player: RosterPlayer | undefined; onRemove: () => void }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: `spot:${position}:${player?.id}`,
    data: { playerId: player?.id, from: position },
  });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      className={`flex max-w-full cursor-grab items-center gap-0.5 rounded bg-navy-950/90 pl-1.5 text-[11px] leading-5 font-semibold text-ink touch-manipulation sm:text-xs ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span className="truncate">{player?.short ?? "Player"}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Take ${player?.name ?? "player"} off ${position}`}
        className="px-1 text-muted hover:text-pink"
      >
        ×
      </button>
    </span>
  );
}

function PositionZone({
  position,
  players,
  roster,
  armed,
  onTap,
  onRemove,
}: {
  position: PlanPosition;
  players: string[];
  roster: Map<string, RosterPlayer>;
  armed: boolean;
  onTap: () => void;
  onRemove: (playerId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `pos:${position}` });
  return (
    <div ref={setNodeRef} className="absolute flex w-[23%] -translate-x-1/2 -translate-y-3.5 flex-col items-center gap-0.5" style={spotStyle(position)}>
      <button
        type="button"
        onClick={onTap}
        aria-label={`${position}: ${players.length ? players.map((id) => roster.get(id)?.name).join(", ") : "nobody yet"}${armed ? ". Tap to place the selected player" : ""}`}
        className={`rounded-full transition ${isOver || armed ? "ring-2 ring-neon ring-offset-2 ring-offset-navy-950" : ""}`}
      >
        <PositionBadge position={position} active={players.length > 0} />
      </button>
      {players.map((id) => (
        <PlacedChip key={id} position={position} player={roster.get(id)} onRemove={() => onRemove(id)} />
      ))}
    </div>
  );
}

function RosterDrop({ children, active }: { children: ReactNode; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "roster" });
  return (
    <div ref={setNodeRef} className={`rounded-xl transition ${isOver && active ? "ring-2 ring-pink" : ""}`}>
      {children}
    </div>
  );
}

function FieldPlanner({ roster, spots, onChange }: { roster: RosterPlayer[]; spots: PlanSpot[]; onChange: (spots: PlanSpot[]) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ playerId: string; from?: PlanPosition } | null>(null);
  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const place = (playerId: string, position: PlanPosition, from?: PlanPosition) => {
    let next = spots;
    if (from && from !== position) next = next.filter((s) => !(s.position === from && s.player_id === playerId));
    if (!next.some((s) => s.position === position && s.player_id === playerId)) next = [...next, { position, player_id: playerId }];
    onChange(next);
  };
  const remove = (playerId: string, position: PlanPosition) =>
    onChange(spots.filter((s) => !(s.position === position && s.player_id === playerId)));

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const data = e.active.data.current as { playerId?: string; from?: PlanPosition } | undefined;
    const over = e.over ? String(e.over.id) : null;
    if (!data?.playerId || !over) return;
    if (over.startsWith("pos:")) place(data.playerId, over.slice(4) as PlanPosition, data.from);
    else if (over === "roster" && data.from) remove(data.playerId, data.from);
  }

  const counts = new Map<string, number>();
  for (const s of spots) counts.set(s.player_id, (counts.get(s.player_id) ?? 0) + 1);
  const selectedPlayer = selected ? byId.get(selected) : null;

  return (
    <DndContext
      id="plan-field"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setDragging(e.active.data.current as { playerId: string; from?: PlanPosition })}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,15rem)_1fr]">
        <RosterDrop active={Boolean(dragging?.from)}>
          <p className={`${sectionLabelClass} mb-2`}>Roster</p>
          {roster.length === 0 ? (
            <EmptyState>No active players on this team&apos;s roster.</EmptyState>
          ) : (
            <ul className="grid max-h-[26rem] grid-cols-2 gap-1.5 overflow-y-auto pr-1 md:grid-cols-1">
              {roster.map((p) => (
                <RosterChip
                  key={p.id}
                  player={p}
                  count={counts.get(p.id) ?? 0}
                  selected={selected === p.id}
                  onTap={() => setSelected((s) => (s === p.id ? null : p.id))}
                />
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">
            {selectedPlayer
              ? `Now tap a position for ${selectedPlayer.name}.`
              : "Drag a player to a position, or tap a player and then a position. More than one player can share a spot."}
          </p>
        </RosterDrop>
        <FieldFrame label="Practice field" className="max-w-xl">
          {PLAN_POSITIONS.map((pos) => (
            <PositionZone
              key={pos}
              position={pos}
              players={spots.filter((s) => s.position === pos).map((s) => s.player_id)}
              roster={byId}
              armed={Boolean(selected)}
              onTap={() => {
                if (selected) {
                  place(selected, pos);
                  setSelected(null);
                }
              }}
              onRemove={(id) => remove(id, pos)}
            />
          ))}
        </FieldFrame>
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <span className="rounded bg-pink px-2 py-1 text-xs font-semibold text-on-accent shadow-lg">
            {byId.get(dragging.playerId)?.short ?? "Player"}
          </span>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

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
          <form action={deletePracticePlan} className="ml-auto">
            <input type="hidden" name="id" value={plan.id} />
            <input type="hidden" name="team_id" value={plan.team.id} />
            <ConfirmSubmit message="Delete this draft practice plan? This can't be undone." className="text-xs text-danger hover:underline">
              Delete draft
            </ConfirmSubmit>
          </form>
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
