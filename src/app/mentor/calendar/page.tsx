import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getMentor, getMentorAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pillQuietClass } from "@/components/ui";
import { monthGrid, monthLabel, monthOf, shiftMonth } from "@/lib/dugout";
import { playerName } from "@/lib/softball";
import { todayISO } from "@/lib/dates";
import { CalendarView } from "@/app/(staff)/dugout/calendar/calendar";
import { loadMentees } from "../parts";
import { loadMentorCalendar } from "../calendar-data";

export const metadata: Metadata = { title: "My calendar · Mentor · GGG.Cafe" };

// A mentor's own calendar (user, 2026-11-13): the training she put on her players' weeks (one day
// or every week on chosen days), the video calls she booked, and her players' team practices,
// events and games (mentor_calendar(): mentors can't read the team schedule tables themselves; the
// Switchboard's "See the team calendar" hides a team's). View only: training is added on My players
// or a player's page, calls on the player's page.
export default async function MentorCalendarPage({ searchParams }: PageProps<"/mentor/calendar">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const mentor = await getMentor();
  if (!mentor) redirect("/mentor");
  const { month: monthParam } = await searchParams;
  const today = todayISO();
  const month = monthOf(monthParam, today);
  const days = monthGrid(month);
  const [from, to] = [days[0], days[days.length - 1]];

  const supabase = await createClient();
  const cards = await loadMentees(supabase, (await getMentorAccess()).menteeIds);
  const nameOf = (id: string) => {
    const c = cards.get(id);
    return c ? playerName(c.player) : "A player";
  };
  const { events, games } = await loadMentorCalendar(supabase, mentor.userId, nameOf, from, to);

  const link = (m: string) => `/mentor/calendar?month=${m}`;
  return (
    <div className="flex flex-col gap-6">
      <Link href="/mentor" className="self-start text-sm text-muted hover:text-ink">
        <span aria-hidden="true">←</span> Mentor menu
      </Link>
      <CalendarView
        key={month}
        teamId=""
        month={month}
        days={days}
        today={today}
        events={events}
        games={games}
        canEdit={false}
        heading={
          <div>
            <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">{monthLabel(month)}</h2>
            <p className="mt-1 text-sm text-muted">
              Your training and video calls, and your players&apos; team practices, events and games (pink). Tap one for the details.
            </p>
          </div>
        }
        monthNav={
          <nav aria-label="Month" className="flex items-center gap-2">
            <Link href={link(shiftMonth(month, -1))} className={pillQuietClass} aria-label="Previous month">
              ←
            </Link>
            {month !== today.slice(0, 7) && (
              <Link href={link(today.slice(0, 7))} className={pillQuietClass}>
                Today
              </Link>
            )}
            <Link href={link(shiftMonth(month, 1))} className={pillQuietClass} aria-label="Next month">
              →
            </Link>
          </nav>
        }
      />
      <p className="text-xs text-muted">Add training on My players or a player&apos;s page; book a video call on the player&apos;s page.</p>
    </div>
  );
}
