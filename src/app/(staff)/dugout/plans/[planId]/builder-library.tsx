"use client";

// The plan builder's drill library: search, filter, drag a drill in or tap + Add.
import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { DrillTags } from "@/components/drill-tags";
import { Card, inputClass } from "@/components/ui";
import { filterDrills, type DrillTag, type LibraryDrill } from "@/lib/dugout";
import { TagFilter } from "../../drills/library";
import { GripIcon, chip, labelClass } from "./builder-shared";

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export function LibraryItem({ drill, onAdd }: { drill: LibraryDrill; onAdd: () => void }) {
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

export function LibraryPanel({
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
