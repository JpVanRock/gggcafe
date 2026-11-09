import { Disclosure } from "@/components/ui";
import { formatLongDate } from "@/lib/dates";
import type { HaradaChart, HaradaPillar } from "./data";
import { GoalActionCheckbox, GoalsForm } from "./goals-client";
import { DetailHeading, MenuItem } from "./menu";

function progress(pillars: HaradaPillar[]) {
  const actions = pillars.flatMap((p) => p.actions);
  return { done: actions.filter((a) => a.done_on).length, total: actions.length };
}

export function GoalsSummary({ chart }: { chart: HaradaChart | null }) {
  if (!chart) {
    return <MenuItem name="Not set up yet" note="Set the main goal and the 8 areas that get there." />;
  }
  const { done, total } = progress(chart.pillars);
  return (
    <div>
      <p className="max-w-3xl text-xl leading-snug font-semibold sm:text-2xl">“{chart.main_goal}”</p>
      <p className="mt-2 font-mono text-xs tracking-wider uppercase opacity-75">
        {chart.target_date && `By ${formatLongDate(chart.target_date)} · `}
        {done}/{total} actions done
      </p>
      {chart.pillars.length > 0 && (
        <div className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {chart.pillars.map((p) => {
            const next = p.actions.find((a) => !a.done_on);
            return (
              <MenuItem
                key={p.id}
                name={p.title}
                value={`${p.actions.filter((a) => a.done_on).length}/${p.actions.length}`}
                note={next ? `Next: ${next.title}` : p.actions.length ? "All done" : "No actions yet"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Positions around the center of a 3×3 block, row by row (4 is the center).
const RING = [0, 1, 2, 3, 5, 6, 7, 8];

function Cell({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-16 items-center justify-center rounded p-1.5 text-center text-2xs leading-tight break-words ${className}`}>
      {children}
    </div>
  );
}

/** The classic Harada "Open Window 64" chart: main goal in the middle, 8 areas, 8 actions each. */
function OpenWindow64({ chart }: { chart: HaradaChart }) {
  const pillarAt = (slot: number) => chart.pillars.find((p) => p.position === RING.indexOf(slot) + 1);
  return (
    <div className="grid grid-cols-3 gap-1.5" role="img" aria-label="Harada chart: main goal, 8 areas and their actions">
      {Array.from({ length: 9 }, (_, block) => {
        if (block === 4) {
          return (
            <div key={block} className="grid grid-cols-3 gap-0.5 rounded-lg bg-pink/25 p-0.5">
              {Array.from({ length: 9 }, (_, cell) =>
                cell === 4 ? (
                  <Cell key={cell} className="bg-neon font-bold text-on-accent">
                    {chart.main_goal}
                  </Cell>
                ) : (
                  <Cell key={cell} className="bg-navy-800 font-semibold text-highlight">
                    {pillarAt(cell)?.title}
                  </Cell>
                ),
              )}
            </div>
          );
        }
        const pillar = pillarAt(block);
        return (
          <div key={block} className="grid grid-cols-3 gap-0.5 rounded-lg bg-navy-800/60 p-0.5">
            {Array.from({ length: 9 }, (_, cell) => {
              if (cell === 4) {
                return (
                  <Cell key={cell} className="bg-navy-700 font-semibold text-highlight">
                    {pillar?.title}
                  </Cell>
                );
              }
              const action = pillar?.actions.find((a) => a.position === RING.indexOf(cell) + 1);
              return (
                <Cell key={cell} className={action?.done_on ? "bg-neon/15 text-highlight" : "bg-navy-950/70 text-ink"}>
                  {action && (
                    <span>
                      {action.title}
                      {action.done_on && " ✓"}
                    </span>
                  )}
                </Cell>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function GoalsDetail({ playerId, chart, canEdit }: { playerId: string; chart: HaradaChart | null; canEdit: boolean }) {
  if (!chart) {
    return (
      <div className="flex flex-col gap-6">
        <div className="max-w-2xl text-sm text-muted">
          <p>
            The Harada Method puts one big goal in the middle, surrounds it with 8 areas that make it happen, and gives each area 8
            concrete actions: 64 squares in all. Shohei Ohtani made one as a high-school freshman.
          </p>
        </div>
        {canEdit ? <GoalsForm playerId={playerId} chart={null} /> : <p className="text-sm text-muted">No goal chart yet.</p>}
      </div>
    );
  }

  const { done, total } = progress(chart.pillars);
  return (
    <div className="flex flex-col gap-8">
      <section>
        <DetailHeading>Main goal</DetailHeading>
        <p className="text-2xl leading-snug font-semibold text-highlight">{chart.main_goal}</p>
        {chart.purpose && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-ink/90">{chart.purpose}</p>}
        <p className="mt-3 font-mono text-xs tracking-wider text-muted uppercase">
          {chart.target_date && `Target ${formatLongDate(chart.target_date)} · `}
          {done}/{total} actions done
        </p>
      </section>

      {chart.pillars.length > 0 && (
        <section className="hidden md:block">
          <DetailHeading>The chart</DetailHeading>
          <OpenWindow64 chart={chart} />
        </section>
      )}

      {chart.pillars.length > 0 && (
        <section>
          <DetailHeading>Areas and actions</DetailHeading>
          <div className="grid gap-4 md:grid-cols-2">
            {chart.pillars.map((p) => (
              <div key={p.id} className="rounded-xl border border-navy-700 bg-navy-950/40 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="font-semibold">{p.title}</h4>
                  <span className="font-mono text-sm text-highlight tabular-nums">
                    {p.actions.filter((a) => a.done_on).length}/{p.actions.length}
                  </span>
                </div>
                {p.actions.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No actions yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {p.actions.map((a) => (
                      <li key={a.id}>
                        {canEdit ? (
                          <GoalActionCheckbox actionId={a.id} title={a.title} done={Boolean(a.done_on)} />
                        ) : (
                          <span className={`text-sm ${a.done_on ? "text-muted line-through decoration-pink" : ""}`}>{a.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {canEdit && (
        <Disclosure summary="Edit goal chart">
          <GoalsForm playerId={playerId} chart={chart} />
        </Disclosure>
      )}
    </div>
  );
}
