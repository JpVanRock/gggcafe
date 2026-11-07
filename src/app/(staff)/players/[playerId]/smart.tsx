import { ConfirmSubmit } from "@/components/confirm-submit";
import { Disclosure, EmptyState, secondaryButtonClass } from "@/components/ui";
import { formatLongDate } from "@/lib/dates";
import { SKILL_AREA_LABEL, type SkillArea } from "@/lib/softball";
import { deleteSmartGoal, setSmartGoalStatus } from "./actions";
import type { MetricOption, MetricProgress, SmartGoal } from "./data";
import { DetailHeading, MenuItem } from "./menu";
import { SmartGoalForm } from "./smart-client";

const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const short = (iso: string) => monthDay.format(new Date(`${iso}T00:00:00Z`));

/** Latest measurement vs the goal's target, when the goal is tied to one. */
function metricProgress(goal: SmartGoal, metrics: MetricProgress[]) {
  if (!goal.metric_key || goal.target_value === null || !goal.metric) return null;
  const latest = metrics.find((m) => m.metric_key === goal.metric_key)?.latest_value ?? null;
  const target = Number(goal.target_value);
  const higher = goal.metric.better === "higher";
  const reached = latest !== null && (higher ? Number(latest) >= target : Number(latest) <= target);
  const baseline = goal.baseline_value === null ? null : Number(goal.baseline_value);
  let pct: number | null = null;
  if (latest !== null && baseline !== null && baseline !== target) {
    pct = Math.max(0, Math.min(1, (Number(latest) - baseline) / (target - baseline)));
  }
  return { latest: latest === null ? null : Number(latest), target, unit: goal.metric.unit, name: goal.metric.name, reached, pct };
}

export function SmartSummary({ goals, metrics }: { goals: SmartGoal[]; metrics: MetricProgress[] }) {
  const active = goals.filter((g) => g.status === "active");
  const achieved = goals.filter((g) => g.status === "achieved").length;
  if (active.length === 0) {
    return (
      <MenuItem
        name={achieved ? `${achieved} goal${achieved === 1 ? "" : "s"} achieved` : "Not set up yet"}
        note="Specific, measurable, achievable, relevant, time-bound."
      />
    );
  }
  return (
    <div>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {active.slice(0, 6).map((g) => {
          const p = metricProgress(g, metrics);
          return (
            <MenuItem
              key={g.id}
              name={g.title}
              value={p ? (p.latest !== null ? `${p.latest}→${p.target}` : `→${p.target}`) : g.target_date ? `by ${short(g.target_date)}` : undefined}
              note={g.measurable ?? g.specific ?? SKILL_AREA_LABEL[g.area as SkillArea]}
            />
          );
        })}
      </div>
      <p className="mt-5 font-mono text-xs tracking-wider uppercase opacity-75">
        {active.length} active{achieved ? ` · ${achieved} achieved` : ""}
      </p>
    </div>
  );
}

function SmartGoalCard({
  goal,
  metrics,
  metricOptions,
  playerId,
  canEdit,
}: {
  goal: SmartGoal;
  metrics: MetricProgress[];
  metricOptions: MetricOption[];
  playerId: string;
  canEdit: boolean;
}) {
  const p = metricProgress(goal, metrics);
  const done = goal.status === "achieved";
  const rows: [string, string, string | null][] = [
    ["S", "Specific", goal.specific],
    ["M", "Measurable", goal.measurable],
    ["A", "Achievable", goal.achievable],
    ["R", "Relevant", goal.relevant],
    ["T", "Time-bound", goal.target_date ? `By ${formatLongDate(goal.target_date)}` : null],
  ];

  return (
    <article className={`rounded-xl border p-4 ${done ? "border-navy-700 bg-navy-950/30" : "border-navy-600 bg-navy-950/50"}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className={`text-lg font-semibold ${done ? "text-muted" : "text-ink"}`}>{goal.title}</h4>
          <p className="mt-0.5 font-mono text-xs tracking-wider text-muted uppercase">{SKILL_AREA_LABEL[goal.area as SkillArea]}</p>
        </div>
        <span className={`font-mono text-[11px] font-bold tracking-wider uppercase ${done ? "text-highlight" : "text-pink-soft"}`}>
          {done ? `✓ Achieved${goal.achieved_on ? ` ${short(goal.achieved_on)}` : ""}` : "In progress"}
        </span>
      </header>

      <dl className="mt-4 grid gap-2">
        {rows.map(([letter, label, value]) => (
          <div key={letter} className="grid grid-cols-[1.75rem_1fr] gap-2">
            <dt className="font-mono text-lg leading-6 font-bold text-highlight" title={label}>
              {letter}
            </dt>
            <dd className="text-sm leading-6">
              <span className="sr-only">{label}: </span>
              {value ?? <span className="text-muted/70">Not filled in</span>}
            </dd>
          </div>
        ))}
      </dl>

      {p && (
        <div className="mt-4">
          <p className="text-xs text-muted">
            {p.name}: {p.latest !== null ? `latest ${p.latest} ${p.unit}` : "no measurement yet"} · target {p.target} {p.unit}
            {p.reached && <span className="ml-1 font-semibold text-highlight">Target reached</span>}
          </p>
          {p.pct !== null && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy-800" aria-hidden>
              <div className="h-full rounded-full bg-neon" style={{ width: `${p.pct * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <form action={setSmartGoalStatus}>
            <input type="hidden" name="id" value={goal.id} />
            <input type="hidden" name="status" value={done ? "active" : "achieved"} />
            <button type="submit" className={secondaryButtonClass}>
              {done ? "Reopen" : "Mark achieved"}
            </button>
          </form>
          <details className="w-full sm:w-auto sm:flex-1 [&[open]]:w-full">
            <summary className={`${secondaryButtonClass} cursor-pointer list-none`}>Edit</summary>
            <div className="mt-3 rounded-lg border border-navy-700 p-3">
              <SmartGoalForm playerId={playerId} goal={goal} metrics={metricOptions} />
            </div>
          </details>
          <form action={deleteSmartGoal} className="ml-auto">
            <input type="hidden" name="id" value={goal.id} />
            <ConfirmSubmit message={`Delete the goal “${goal.title}”?`} className="text-xs text-danger hover:underline">
              Delete
            </ConfirmSubmit>
          </form>
        </div>
      )}
    </article>
  );
}

export function SmartGoalsPanel({
  playerId,
  goals,
  metrics,
  metricOptions,
  canEdit,
}: {
  playerId: string;
  goals: SmartGoal[];
  metrics: MetricProgress[];
  metricOptions: MetricOption[];
  canEdit: boolean;
}) {
  const active = goals.filter((g) => g.status === "active");
  const past = goals.filter((g) => g.status !== "active");
  const card = (g: SmartGoal) => (
    <SmartGoalCard key={g.id} goal={g} metrics={metrics} metricOptions={metricOptions} playerId={playerId} canEdit={canEdit} />
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <DetailHeading>Current goals</DetailHeading>
        {active.length === 0 ? (
          <EmptyState>No SMART goals yet.{canEdit && " Two or three is a good start."}</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">{active.map(card)}</div>
        )}
      </section>

      {canEdit && (
        <Disclosure summary="Add a SMART goal" open={active.length === 0}>
          <SmartGoalForm playerId={playerId} metrics={metricOptions} />
        </Disclosure>
      )}

      {past.length > 0 && (
        <section>
          <DetailHeading>Achieved and past goals</DetailHeading>
          <div className="grid gap-4 md:grid-cols-2">{past.map(card)}</div>
        </section>
      )}
    </div>
  );
}
