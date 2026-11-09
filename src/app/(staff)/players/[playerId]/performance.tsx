import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { RatingChip } from "@/components/rating-chip";
import { Disclosure, EmptyState, secondaryButtonClass } from "@/components/ui";
import {
  TRAINING_CATEGORY_LABEL, categoriesFor, evaluateAchievements, streaks, weeklyStats,
  type AchievementProgress, type TrainingCategory,
} from "@/lib/achievements";
import { WEEKDAYS, formatLongDate, weekStart } from "@/lib/dates";
import { deleteActivity, endActivity } from "./actions";
import type { Performance, RoutineRow } from "./data";
import type { MyTesting } from "./testing-data";
import { DetailHeading, MenuItem } from "./menu";
import { RoutineForm } from "./performance-client";
import { ActionForm } from "@/components/action-form";

const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const short = (iso: string) => monthDay.format(new Date(`${iso}T00:00:00Z`));

/** Everything the board and pop-up need, worked out once. */
export function summarizePerformance(perf: Performance, positions: string[], today: string) {
  const thisMonday = weekStart(today);
  const active = perf.routines.filter((r) => r.ends_on === null || r.ends_on >= today);
  const thisWeek = (routines: RoutineRow[]) => {
    const week = weeklyStats(routines, perf.checks, today).find((w) => w.monday === thisMonday);
    return { done: week?.done ?? 0, planned: week?.scheduled ?? 0 };
  };
  const weeks = weeklyStats(perf.routines, perf.checks, today);
  const streak = streaks(weeks, today);
  const earned = new Map(perf.earned.map((e) => [e.achievement_key, e.unlocked_on]));
  const achievements: AchievementProgress[] = evaluateAchievements({
    routines: perf.routines,
    checks: perf.checks,
    today,
    positions,
  }).map((p) => ({ ...p, unlockedOn: earned.get(p.def.key) ?? p.unlockedOn }));
  const categories = categoriesFor(positions).map((category) => {
    const routines = active.filter((r) => r.category === category);
    return { category, routines, week: thisWeek(routines) };
  });
  return {
    categories,
    achievements,
    week: thisWeek(active),
    streak,
    total: perf.checks.filter((c) => c.on_date <= today).length,
  };
}

type Summary = ReturnType<typeof summarizePerformance>;

function daysText(days: number[]) {
  return days.length ? days.map((d) => WEEKDAYS[d - 1].short).join(", ") : "Once a week";
}

export function PerformanceSummary({ summary }: { summary: Summary }) {
  const unlocked = summary.achievements.filter((a) => a.unlockedOn);
  const latest = [...unlocked].sort((a, b) => (b.unlockedOn ?? "").localeCompare(a.unlockedOn ?? "")).slice(0, 3);
  return (
    <div>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {summary.categories.map(({ category, routines, week }) => (
          <MenuItem
            key={category}
            name={TRAINING_CATEGORY_LABEL[category].title}
            value={week.planned ? `${week.done}/${week.planned}` : undefined}
            note={routines.length ? routines.map((r) => r.title).join(", ") : "Nothing yet"}
          />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs tracking-wider text-muted uppercase">
          {unlocked.length}/{summary.achievements.length} achievements
          {summary.streak.current > 0 && ` · ${summary.streak.current}-week streak`}
        </span>
        {latest.map((a) => (
          <span key={a.def.key} className="rounded-md border border-neon/60 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-highlight uppercase">
            {a.def.title}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Hexagon badge: solid neon with a check when earned, outlined with the % done while locked. */
export function HexBadge({ unlocked, pct }: { unlocked: boolean; pct: number }) {
  return (
    <svg viewBox="0 0 40 44" aria-hidden className="h-11 w-10 shrink-0">
      <path
        d="M20 2 37 11.5v21L20 42 3 32.5v-21Z"
        className={unlocked ? "fill-neon stroke-neon" : "fill-navy-800 stroke-navy-600"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {unlocked ? (
        <path d="m13 22.5 5 5 9-10" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="stroke-on-accent" />
      ) : (
        <text x="20" y="26" textAnchor="middle" className="fill-muted font-mono text-[10px] font-bold">
          {pct}%
        </text>
      )}
    </svg>
  );
}

function AchievementBadge({ a }: { a: AchievementProgress }) {
  const unlocked = Boolean(a.unlockedOn);
  return (
    <li
      className={`rounded-xl border p-3 ${unlocked ? "border-neon bg-neon/10" : "border-navy-700 bg-navy-950/40"}`}
      aria-label={`${a.def.title}: ${unlocked ? "unlocked" : `${a.current} of ${a.target}`}`}
    >
      <div className="flex items-start gap-2.5">
        <HexBadge unlocked={unlocked} pct={Math.round((a.current / a.target) * 100)} />
        <div className="min-w-0">
          <p className={`text-sm font-bold ${unlocked ? "text-highlight" : "text-ink"}`}>{a.def.title}</p>
          <p className="text-xs text-muted">{a.def.description}</p>
        </div>
      </div>
      {unlocked ? (
        <p className="mt-2 font-mono text-[11px] tracking-wider text-pink-soft uppercase">Unlocked {short(a.unlockedOn!)}</p>
      ) : (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-800" aria-hidden>
            <div className="h-full rounded-full bg-pink" style={{ width: `${(a.current / a.target) * 100}%` }} />
          </div>
          <span className="font-mono text-[11px] text-muted tabular-nums">
            {a.current}/{a.target}
          </span>
        </div>
      )}
    </li>
  );
}

function RoutineCard({ r, today, canEdit, playerId }: { r: RoutineRow; today: string; canEdit: boolean; playerId: string }) {
  // pushed from Coaches Dugout → Training: changed or ended there, for the whole team
  const fromCoach = r.source === "coach";
  return (
    <li className={`rounded-xl border bg-navy-950/40 p-3 ${fromCoach ? "border-pink/50" : "border-navy-700"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{r.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            {daysText(r.days)} · since {short(r.starts_on)}
            {fromCoach && <span className="ml-1.5 rounded border border-pink px-1 py-px font-mono text-[10px] font-bold tracking-wider text-pink-soft uppercase">From your coach</span>}
          </p>
        </div>
        {canEdit && !fromCoach && (
          <div className="flex items-center gap-2">
            {(!r.ends_on || r.ends_on >= today) && (
              <ActionForm action={endActivity}>
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className={secondaryButtonClass}>
                  End
                </button>
              </ActionForm>
            )}
            <ActionForm action={deleteActivity}>
              <input type="hidden" name="id" value={r.id} />
              <ConfirmSubmit
                message={`Delete “${r.title}” and its check-offs? Use End to keep the history (achievements already earned stay either way).`}
                className="text-xs text-danger hover:underline"
              >
                Delete
              </ConfirmSubmit>
            </ActionForm>
          </div>
        )}
      </div>
      {r.details && <p className="mt-2 font-mono text-sm text-highlight">{r.details}</p>}
      {r.drill?.description && <p className="mt-1.5 text-sm text-ink/85">{r.drill.description}</p>}
      {r.drill?.equipment && <p className="mt-1 text-xs text-muted">Equipment: {r.drill.equipment}</p>}
      {r.drill?.video_url && (
        <a href={r.drill.video_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-pink-soft underline">
          Watch it ↗
        </a>
      )}
      {r.drill?.guide && (
        <Link href={`/players/${playerId}/mental/session/${r.drill.guide}`} className="mt-2 inline-block text-sm font-semibold text-pink-soft hover:underline">
          Start the session →
        </Link>
      )}
    </li>
  );
}

export function PerformanceDetail({
  playerId,
  perf,
  summary,
  today,
  canEdit,
  testing = null,
}: {
  playerId: string;
  perf: Performance;
  summary: Summary;
  today: string;
  canEdit: boolean;
  /** her athletic testing results (Coaches Dugout → Training → Testing) */
  testing?: MyTesting | null;
}) {
  const stats: [string, string][] = [
    ["This week", summary.week.planned ? `${summary.week.done}/${summary.week.planned}` : "–"],
    ["Current streak", `${summary.streak.current} wk`],
    ["Best streak", `${summary.streak.best} wk`],
    ["Check-offs", String(summary.total)],
  ];
  const unlocked = summary.achievements.filter((a) => a.unlockedOn).length;
  const libraryFor = (category: TrainingCategory) =>
    perf.library.filter((d) => d.category === category || d.category === null).map(({ id, name }) => ({ id, name }));

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-navy-700 p-3">
            <dt className="font-mono text-[11px] tracking-wider text-muted uppercase">{label}</dt>
            <dd className="mt-1 text-2xl font-bold text-highlight tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-4 text-xs text-muted">
        A streak week means 80% or more of the planned routines were checked off in TWIS.
      </p>

      {testing && testing.results.length > 0 && (
        <section>
          <DetailHeading>Athletic testing{testing.composite !== null && ` · score ${testing.composite}`}</DetailHeading>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {testing.results.map((r) => {
              const change = r.previous === null ? null : Math.round((r.value - r.previous) * 100) / 100;
              const better = change !== null && change !== 0 && (r.test.better === "higher" ? change > 0 : change < 0);
              return (
                <li key={r.test.key} className="flex items-center justify-between gap-3 rounded-xl border border-navy-700 p-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{r.test.name}</span>
                    <span className="font-display text-xl font-bold text-highlight tabular-nums">
                      {r.value}
                      <span className="ml-1 text-xs font-normal text-muted">{r.test.unit}</span>
                    </span>
                    {change !== null && change !== 0 && (
                      <span className={`ml-2 font-mono text-xs ${better ? "text-highlight" : "text-muted"}`}>
                        {change > 0 ? "+" : ""}
                        {change} since last
                      </span>
                    )}
                  </span>
                  <RatingChip rating={r.rating} />
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Your latest result in each test, rated against {testing.ageGroup ?? "13U-14U"} bands. Beat your own last result; that&apos;s the
            only comparison that counts.
          </p>
        </section>
      )}

      <section>
        <DetailHeading>
          Achievements · {unlocked}/{summary.achievements.length} unlocked
        </DetailHeading>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...summary.achievements]
            .sort((a, b) => Number(Boolean(b.unlockedOn)) - Number(Boolean(a.unlockedOn)) || b.current / b.target - a.current / a.target)
            .map((a) => (
              <AchievementBadge key={a.def.key} a={a} />
            ))}
        </ul>
      </section>

      {summary.categories.map(({ category, routines, week }) => {
        const label = TRAINING_CATEGORY_LABEL[category];
        return (
          <section key={category}>
            <DetailHeading>
              {label.title}
              {week.planned > 0 && ` · ${week.done}/${week.planned} this week`}
            </DetailHeading>
            {routines.length === 0 ? (
              <EmptyState>No {label.title.toLowerCase()} yet.</EmptyState>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {routines.map((r) => (
                  <RoutineCard key={r.id} r={r} today={today} canEdit={canEdit} playerId={playerId} />
                ))}
              </ul>
            )}
            {canEdit && (
              <div className="mt-3">
                <Disclosure summary={`Add a ${label.one}`}>
                  <RoutineForm playerId={playerId} category={category} library={libraryFor(category)} defaultStart={today} />
                </Disclosure>
              </div>
            )}
          </section>
        );
      })}

      {perf.routines.some((r) => r.ends_on !== null && r.ends_on < today) && (
        <p className="text-xs text-muted">
          Ended routines are hidden but still count toward consistency and achievements. Earliest routine started{" "}
          {formatLongDate([...perf.routines].sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0].starts_on)}.
        </p>
      )}
    </div>
  );
}
