// Performance Training → Pitching (Phase 4): her team's bullpen scripts to throw,
// her command by pitch type, recent bullpens and her game plans.
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { commandByPitch, sessionPct } from "@/lib/bullpen";
import type { BullpenScript, BullpenSession } from "./pitching-data";
import { DetailHeading } from "./menu";

export function PitchingSection({ playerId, scripts, sessions, canEdit }: { playerId: string; scripts: BullpenScript[]; sessions: BullpenSession[]; canEdit: boolean }) {
  const command = commandByPitch(sessions);
  const names = new Map(scripts.map((s) => [s.id, s.name]));
  return (
    <section className="flex flex-col gap-4">
      <DetailHeading>Bullpens and game plans</DetailHeading>
      {command.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-widest text-muted uppercase">Command by pitch · last {sessions.length} bullpens</p>
          <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {command.map((c) => (
              <li key={c.pitch} className="rounded-xl border border-navy-700 p-3">
                <p className="text-sm font-semibold">{c.pitch}</p>
                <p className="font-display text-2xl font-bold text-highlight tabular-nums">
                  {c.pct}% <span className="text-xs font-normal text-muted">{c.hits}/{c.thrown}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {scripts.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {scripts.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-navy-700 p-3">
              <span>
                <span className="block font-semibold">{s.name}</span>
                <span className="text-xs text-muted">{s.pitches.length} pitches</span>
              </span>
              {canEdit && (
                <Link href={`/players/${playerId}/training/bullpen/${s.id}`} className="rounded-full border border-pink px-3 py-1 text-sm font-semibold text-pink-soft hover:bg-pink hover:text-on-accent">
                  Throw it →
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No bullpen scripts from your coaches yet.</EmptyState>
      )}
      {sessions.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {sessions.slice(0, 5).map((s) => (
            <li key={s.id} className="flex gap-3">
              <span className="w-28 text-muted">{formatDay(s.thrown_on)}</span>
              <span>{(s.script_id && names.get(s.script_id)) || "Bullpen"}</span>
              <span className="ml-auto font-display font-bold text-highlight tabular-nums">{sessionPct(s.results)}%</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/players/${playerId}/training/game-plan`} className="self-start text-sm font-semibold text-pink hover:underline">
        Game plans: before and after each game →
      </Link>
    </section>
  );
}
