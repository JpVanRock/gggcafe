"use client";

// The plan builder's field: drag players from the roster to positions, or tap a player then a position.
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useMemo, useState, type ReactNode } from "react";
import { FieldFrame, PositionBadge, spotStyle } from "@/components/practice-field";
import { CountBadge, EmptyState, sectionLabelClass } from "@/components/ui";
import { PLAN_POSITIONS, type PlanPosition } from "@/lib/dugout";
import type { PlanSpot, RosterPlayer } from "@/lib/practice-plans";

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

export function RosterChip({ player, count, selected, onTap }: { player: RosterPlayer; count: number; selected: boolean; onTap: () => void }) {
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
        {player.primary && <span className="font-mono text-2xs text-muted">{player.primary}</span>}
        <CountBadge count={count} label={`On the field ${count} time${count === 1 ? "" : "s"}`} tone="neon" />
      </button>
    </li>
  );
}

export function PlacedChip({ position, player, onRemove }: { position: PlanPosition; player: RosterPlayer | undefined; onRemove: () => void }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: `spot:${position}:${player?.id}`,
    data: { playerId: player?.id, from: position },
  });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      className={`flex max-w-full cursor-grab items-center gap-0.5 rounded bg-navy-950/90 pl-1.5 text-2xs leading-5 font-semibold text-ink touch-manipulation sm:text-xs ${
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
        className="px-1 text-muted hover:text-link"
      >
        ×
      </button>
    </span>
  );
}

export function PositionZone({
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

export function RosterDrop({ children, active }: { children: ReactNode; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "roster" });
  return (
    <div ref={setNodeRef} className={`rounded-xl transition ${isOver && active ? "ring-2 ring-pink" : ""}`}>
      {children}
    </div>
  );
}

export function FieldPlanner({ roster, spots, onChange }: { roster: RosterPlayer[]; spots: PlanSpot[]; onChange: (spots: PlanSpot[]) => void }) {
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
