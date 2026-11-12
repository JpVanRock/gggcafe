// Read views of the Team Hitting Philosophy and a Throwing Program group (user,
// 2026-11-12): the player's Team page and the Dugout's read-only view share them.
import { OutlineText, SpeedStripes } from "@/components/athletic";
import type { PhilosophySection, ThrowStep } from "@/lib/team-programs";

export function PhilosophyView({ statement, sections }: { statement: string | null; sections: PhilosophySection[] }) {
  return (
    <div className="flex flex-col gap-6">
      {statement && (
        <p className="flex max-w-3xl gap-3 font-display text-xl leading-snug font-bold tracking-wide text-highlight uppercase">
          <SpeedStripes className="mt-1.5 h-4 w-10 shrink-0 text-link" />
          <span>{statement}</span>
        </p>
      )}
      {sections.length > 0 && (
        <ol className="grid gap-4 md:grid-cols-2">
          {sections.map((s, i) => (
            <li key={i} className="relative overflow-hidden rounded-2xl border border-navy-600 bg-navy-900/70 p-4">
              <OutlineText className="absolute -top-1 right-2 text-5xl">{String(i + 1).padStart(2, "0")}</OutlineText>
              <p className="relative pr-12 font-display text-lg leading-tight font-bold tracking-wide uppercase">{s.title}</p>
              {s.body && <p className="relative mt-2 text-sm whitespace-pre-line text-ink/90">{s.body}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ThrowingView({ intro, steps }: { intro: string | null; steps: ThrowStep[] }) {
  return (
    <div className="flex flex-col gap-4">
      {intro && <p className="max-w-3xl text-ink/90">{intro}</p>}
      {steps.length > 0 && (
        <ol className="flex flex-col divide-y divide-navy-800 rounded-2xl border border-navy-600 bg-navy-900/70">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-4 p-4">
              <span className="font-display text-2xl leading-none font-bold text-highlight tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-semibold">{s.name}</span>
                  {s.dose && <span className="font-display text-sm text-muted tabular-nums">{s.dose}</span>}
                </p>
                {s.cue && <p className="text-sm text-ink/90">{s.cue}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
