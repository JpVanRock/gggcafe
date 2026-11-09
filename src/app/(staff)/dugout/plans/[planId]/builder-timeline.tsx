"use client";

// The plan builder's timeline: each block with its time, coaches and equipment.
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import { DrillTags } from "@/components/drill-tags";
import { inputClass } from "@/components/ui";
import { MAX_BLOCK_MINUTES } from "@/lib/dugout";
import { GripIcon, chip, labelClass, type Block } from "./builder-shared";

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export function CoachPicker({
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

export function BlockCard({
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

export function TimelineEnd({ empty, active }: { empty: boolean; active: boolean }) {
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
