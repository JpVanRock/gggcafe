import type { Metadata } from "next";
import Link from "next/link";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Disclosure, secondaryButtonClass, eyebrowClass, badgeClass } from "@/components/ui";
import { addDays, formatDay, formatWeekRange, isISODate, todayISO, weekDates, weekStart } from "@/lib/dates";
import { JOURNAL_PROMPTS } from "@/lib/mental";
import { loadJournalWeek } from "../../../mental-data";
import { JournalDayForm, JournalWeekForm } from "../../../mental-game-client";
import { loadPlayer } from "../../../section-data";
import { DetailHeading } from "../../../menu";
import { SectionShell } from "../../section-shell";

export const metadata: Metadata = { title: "Practice journal · Mental GP · GGG.Cafe" };

// The practice journal (Phase 1, user 2026-11-08): a purpose before practice, what
// worked and what to fix after, and a look back at the week. Team practice days
// are marked; she can write on any day.
export default async function JournalPage({ params, searchParams }: PageProps<"/players/[playerId]/mental/journal">) {
  const { playerId } = await params;
  const { week } = await searchParams;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const today = todayISO();
  const thisMonday = weekStart(today);
  const monday = typeof week === "string" && isISODate(week) ? weekStart(week) : thisMonday;
  const { entries, lookBack, practiceDays } = await loadJournalWeek(supabase, player.id, monday);
  const canEdit = access.canAct;
  const base = `/players/${player.id}/mental/journal`;
  const href = (m: string) => (m === thisMonday ? base : `${base}?week=${m}`);

  return (
    <SectionShell title="Practice journal" subtitle={`Mental GP · ${formatWeekRange(monday)}`}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/players/${player.id}/mental`} className="text-sm text-link hover:underline">
            ← Mental GP
          </Link>
          <nav aria-label="Choose week" className="flex items-center gap-2 font-mono text-sm">
            <Link href={href(addDays(monday, -7))} className={secondaryButtonClass} aria-label="Previous week">
              ←
            </Link>
            <span className="min-w-32 text-center">{formatWeekRange(monday)}</span>
            <Link href={href(addDays(monday, 7))} className={secondaryButtonClass} aria-label="Next week">
              →
            </Link>
            {monday !== thisMonday && (
              <Link href={base} className="ml-1 text-pink-soft underline">
                This week
              </Link>
            )}
          </nav>
        </div>

        <ol className="flex flex-col gap-3">
          {weekDates(monday).map((date) => {
            const entry = entries.find((e) => e.entry_date === date) ?? null;
            const practice = practiceDays.get(date);
            const isToday = date === today;
            const filled = Boolean(entry && (entry.purpose || entry.worked || entry.fix));
            return (
              <li
                key={date}
                id={`d-${date}`}
                className={`scroll-mt-24 rounded-2xl border p-4 ${isToday ? "border-pink bg-pink/5" : practice ? "border-navy-600 bg-navy-900/70" : "border-navy-700"}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-display text-lg font-bold tracking-wide uppercase">{isToday ? "Today" : formatDay(date)}</span>
                  {practice && <span className={badgeClass("neon")}>{practice}</span>}
                </div>
                {filled && (
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    {(["purpose", "worked", "fix"] as const).map((k) =>
                      entry?.[k] ? (
                        <div key={k}>
                          <dt className={eyebrowClass}>{JOURNAL_PROMPTS[k].label}</dt>
                          <dd className="mt-1 whitespace-pre-wrap text-ink/90">{entry[k]}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                )}
                {canEdit && (practice || filled || isToday) && (
                  <div className="mt-3">
                    <Disclosure summary={filled ? "Edit" : "Write it"} open={isToday && !filled && Boolean(practice)}>
                      <JournalDayForm playerId={player.id} date={date} entry={entry} />
                    </Disclosure>
                  </div>
                )}
                {canEdit && !practice && !filled && !isToday && (
                  <div className="mt-2">
                    <Disclosure summary="Add an entry for this day">
                      <JournalDayForm playerId={player.id} date={date} entry={null} />
                    </Disclosure>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <section className="flex flex-col gap-3">
          <DetailHeading>Looking back at the week</DetailHeading>
          {lookBack && <p className="whitespace-pre-wrap text-ink/90">{lookBack}</p>}
          {canEdit ? (
            <Disclosure summary={lookBack ? "Edit my look-back" : "Write my look-back"} open={!lookBack && monday < thisMonday}>
              <JournalWeekForm playerId={player.id} monday={monday} lookBack={lookBack} />
            </Disclosure>
          ) : (
            !lookBack && <p className="text-sm text-muted">No look-back for this week.</p>
          )}
        </section>
      </div>
    </SectionShell>
  );
}
