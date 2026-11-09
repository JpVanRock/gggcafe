import Link from "next/link";
import { EmptyState, secondaryButtonClass } from "@/components/ui";
import { WEEKDAYS, addDays, formatDay, formatWeekRange, isoWeekday, weekStart } from "@/lib/dates";
import { deleteActivity, endActivity } from "./actions";
import type { ActivityRow, TwisWeek } from "./data";
import { DetailHeading } from "./menu";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActivityForm, TwisChecklist, type TwisCellView } from "./twis-client";
import { ActionForm } from "@/components/action-form";

const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

export function TwisBoard({
  playerId,
  week,
  today,
  canEdit,
}: {
  playerId: string;
  week: TwisWeek;
  today: string;
  canEdit: boolean;
}) {
  const thisMonday = weekStart(today);
  const href = (monday: string) => `/players/${playerId}${monday === thisMonday ? "" : `?week=${monday}`}`;

  const cells: TwisCellView[] = week.cells.map((cell) =>
    cell.date
      ? {
          key: cell.key,
          label: WEEKDAYS[isoWeekday(cell.date) - 1].short,
          sublabel: monthDay.format(new Date(`${cell.date}T00:00:00Z`)),
          isToday: cell.date === today,
          isRestDay: true,
          items: cell.items,
          notes: cell.notes,
        }
      : { key: cell.key, label: "Any day", sublabel: "This week", isToday: false, isRestDay: false, items: cell.items },
  );

  return (
    <section
      aria-labelledby="twis-title"
      className="relative overflow-hidden rounded-2xl border border-navy-600 bg-navy-900/80 p-5 sm:p-8"
    >
      {/* Slim brand stripe across the top */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-pink via-pink to-neon" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="twis-title" className="text-4xl leading-none font-bold tracking-wide text-highlight uppercase sm:text-5xl">
            TWIS
          </h2>
          <p className="mt-2 font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">This Week in Softball</p>
          {week.phase && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1" title={week.phase.focus ?? undefined}>
              <span className="rounded border border-neon px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-highlight uppercase">
                {week.phase.name} · Week {week.phase.week} of {week.phase.of}
              </span>
              {week.phase.focus && <span className="text-xs text-muted">{week.phase.focus}</span>}
            </p>
          )}
        </div>
        <nav aria-label="Choose week" className="flex flex-wrap items-center gap-2 font-mono text-sm">
          <Link href={href(addDays(week.monday, -7))} className={secondaryButtonClass} aria-label="Previous week">
            ←
          </Link>
          <span className="min-w-32 text-center">{formatWeekRange(week.monday)}</span>
          <Link href={href(addDays(week.monday, 7))} className={secondaryButtonClass} aria-label="Next week">
            →
          </Link>
          {week.monday !== thisMonday && (
            <Link href={href(thisMonday)} className="ml-1 text-pink-soft underline">
              This week
            </Link>
          )}
        </nav>
      </header>

      <TwisChecklist playerId={playerId} cells={cells} canEdit={canEdit} />

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Practices and games come from the team schedule. Training routines are set up in Performance Training.
        </p>
        {canEdit && (
          <Link href={`/players/${playerId}/activities?week=${week.monday}`} className={secondaryButtonClass}>
            Manage activities →
          </Link>
        )}
      </footer>
    </section>
  );
}


/** The player's own activities: what's current, end or delete them, add new ones. */
export function ActivitiesManager({
  playerId,
  activities,
  today,
  defaultStart,
  pillars,
}: {
  playerId: string;
  activities: ActivityRow[];
  today: string;
  defaultStart: string;
  pillars: { id: string; title: string }[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <DetailHeading>Current and upcoming</DetailHeading>
        {activities.length === 0 ? (
          <EmptyState>No activities yet. Add the first one below.</EmptyState>
        ) : (
          <ul className="divide-y divide-navy-700">
            {activities.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {a.days.length ? a.days.map((d) => WEEKDAYS[d - 1].short).join(", ") : "Once a week"}
                    {" · "}
                    {a.ends_on ? `${formatDay(a.starts_on)} to ${formatDay(a.ends_on)}` : `From ${formatDay(a.starts_on)}, ongoing`}
                    {a.pillar && ` · ${a.pillar.title}`}
                  </p>
                  {a.details && <p className="mt-1 text-sm text-ink/80">{a.details}</p>}
                </div>
                {a.source === "coach" ? (
                  <span className="rounded border border-pink px-1.5 py-px font-mono text-[10px] font-bold tracking-wider text-pink-soft uppercase">From your coach</span>
                ) : (
                <div className="flex items-center gap-2">
                  {(!a.ends_on || a.ends_on >= today) && (
                    <ActionForm action={endActivity}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className={secondaryButtonClass}>
                        End
                      </button>
                    </ActionForm>
                  )}
                  <ActionForm action={deleteActivity}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmSubmit
                      message={`Delete “${a.title}” and all its check-offs? Use End instead to keep the history.`}
                      className="text-xs text-danger hover:underline"
                    >
                      Delete
                    </ConfirmSubmit>
                  </ActionForm>
                </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <DetailHeading>Add an activity</DetailHeading>
        <ActivityForm playerId={playerId} defaultStart={defaultStart} pillars={pillars} />
      </section>
    </div>
  );
}
