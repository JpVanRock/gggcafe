import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getMentor, getMentorAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pillQuietClass } from "@/components/ui";
import { monthGrid, monthLabel, monthOf, shiftMonth } from "@/lib/dugout";
import { APP_TIME_ZONE, addDays, todayISO } from "@/lib/dates";
import { trainingDates } from "@/lib/mentors";
import { callDateAndClock, callEnds } from "@/lib/video-calls";
import { playerName } from "@/lib/softball";
import { VIDEO_CALL_COLUMNS, type VideoCallRow } from "@/components/video-calls";
import { CalendarView, type CalEvent } from "@/app/(staff)/dugout/calendar/calendar";
import { loadMentees } from "../parts";

export const metadata: Metadata = { title: "My calendar · Mentor · GGG.Cafe" };

// A mentor's own calendar (user, 2026-11-13): the training she put on her players' weeks (one day
// or every week on chosen days) and the video calls she booked, by month. View only: training is
// added on My players or a player's page, calls on the player's page.
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
  const access = await getMentorAccess();
  const [cards, { data: trainingRows }, { data: callRows }] = await Promise.all([
    loadMentees(supabase, access.menteeIds),
    supabase
      .from("player_activities")
      .select("id, player_id, title, details, days, starts_on, ends_on")
      .eq("source", "mentor")
      .eq("created_by", mentor.userId)
      .lte("starts_on", to)
      .gte("ends_on", from),
    // a day either side, for time zones
    supabase
      .from("video_calls")
      .select(VIDEO_CALL_COLUMNS)
      .eq("host_id", mentor.userId)
      .is("cancelled_at", null)
      .gte("starts_at", `${addDays(from, -1)}T00:00:00Z`)
      .lte("starts_at", `${addDays(to, 1)}T23:59:59Z`)
      .order("starts_at"),
  ]);
  const nameOf = (id: string) => {
    const c = cards.get(id);
    return c ? playerName(c.player) : "A player";
  };

  // a session sent to several players is one entry per day, naming them all
  const sessions = new Map<string, NonNullable<typeof trainingRows>>();
  for (const r of trainingRows ?? []) {
    const key = [r.title, r.details, r.starts_on, r.ends_on, r.days.join(",")].join("|");
    sessions.set(key, [...(sessions.get(key) ?? []), r]);
  }
  const training: CalEvent[] = [...sessions.values()].flatMap((group) => {
    const r = group[0];
    const who = group.map((x) => nameOf(x.player_id)).join(", ");
    return trainingDates(r, from, to).map((date) => ({
      id: `${r.id}-${date}`,
      kind: "lesson" as const,
      title: r.title,
      date,
      start: null,
      end: null,
      location: null,
      notes: r.details,
      seriesId: null,
      byline: `For ${who}`,
      planId: null,
    }));
  });
  const calls: CalEvent[] = ((callRows ?? []) as VideoCallRow[]).flatMap((c) => {
    const start = callDateAndClock(c.starts_at, APP_TIME_ZONE);
    if (start.date < from || start.date > to) return [];
    const first = c.player ? c.player.preferred_name || c.player.first_name : "a player";
    return [
      {
        id: c.id,
        kind: "meeting" as const,
        title: `Video call · ${first}`,
        date: start.date,
        start: start.clock,
        end: callDateAndClock(callEnds(c).toISOString(), APP_TIME_ZONE).clock,
        location: "On GGG.Cafe (Zoom)",
        notes: c.topic,
        seriesId: null,
        byline: null,
        planId: null,
      },
    ];
  });

  const link = (m: string) => `/mentor/calendar?month=${m}`;
  return (
    <div className="flex flex-col gap-6">
      <Link href="/mentor" className="self-start text-sm text-muted hover:text-ink">
        ← My players
      </Link>
      <CalendarView
        key={month}
        teamId=""
        month={month}
        days={days}
        today={today}
        events={[...training, ...calls]}
        games={[]}
        canEdit={false}
        heading={
          <div>
            <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">{monthLabel(month)}</h2>
            <p className="mt-1 text-sm text-muted">Your training on your players&apos; weeks and your video calls. Tap one for the details.</p>
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
