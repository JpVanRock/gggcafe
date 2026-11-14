// "Coming up" (user, 2026-11-13): the next few weeks of a calendar, by day, as a board like the
// player's This Week: the family menu (team practices and games) and the mentor menu (her training,
// video calls and her players' team schedule).
import Link from "next/link";
import { byDay, type ComingUpItem } from "@/lib/family";
import { clockLabel, parseClock } from "@/lib/dugout";
import { formatDay } from "@/lib/dates";

const time = (t: string | null) => {
  const m = parseClock(t);
  return m === null ? null : clockLabel(m).replace(":00 ", " ");
};

/** What's coming up, by day: a board like the player's This Week, with "Full calendar →". */
export function ComingUpCard({
  items,
  teams = [],
  calendarHref,
  subtitle = "The next three weeks",
  empty = "Nothing on the team calendar in the next three weeks.",
}: {
  items: ComingUpItem[];
  /** names each line's team when there's more than one */
  teams?: { id: string; name: string }[];
  calendarHref: string;
  subtitle?: string;
  empty?: string;
}) {
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  return (
    <section aria-labelledby="coming-up" className="rounded-2xl border-2 border-neon bg-navy-900 p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="coming-up" className="text-3xl leading-none font-bold tracking-wide text-highlight uppercase sm:text-4xl">
            Coming up
          </h2>
          <p className="mt-2 font-mono text-xs tracking-[0.2em] text-pink-soft uppercase">{subtitle}</p>
        </div>
        <Link href={calendarHref} className="font-mono text-xs tracking-widest text-highlight uppercase hover:underline">
          Full calendar <span aria-hidden="true">→</span>
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-5 text-sm text-muted">{empty}</p>
      ) : (
        <ol className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
          {byDay(items).map((day) => (
            <li key={day.date}>
              <p className="font-display text-sm font-bold tracking-wide text-highlight uppercase">{formatDay(day.date)}</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {day.items.map((i) => (
                  <li
                    key={i.key}
                    className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg border-l-[3px] bg-navy-800/60 px-3 py-2 text-sm ${i.game ? "border-l-pink" : "border-l-neon"}`}
                  >
                    <span className="w-14 shrink-0 font-display text-muted tabular-nums">{time(i.start) ?? "TBA"}</span>
                    <span className="font-semibold">{i.game ? `Game ${i.title}` : i.title}</span>
                    {i.place && <span className="text-muted">{i.place}</span>}
                    {teams.length > 1 && <span className="text-xs text-muted">{teamName.get(i.teamId)}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
