import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Loading, pillQuietClass } from "@/components/ui";
import { monthGrid, monthLabel, monthOf, shiftMonth } from "@/lib/dugout";
import { todayISO } from "@/lib/dates";
import { CalendarView, type CalEvent, type CalGame } from "@/app/(staff)/dugout/calendar/calendar";
import { TeamPicker, pickTeam } from "@/app/(staff)/dugout/team-picker";
import { FamilyHeader } from "../header";
import { VIDEO_CALL_COLUMNS, type VideoCallRow } from "@/components/video-calls";
import { callEvents, callRange } from "@/lib/call-events";

export const metadata: Metadata = { title: "Calendar · GGG.Cafe" };

// The team calendar for parents (user, 2026-11-13): the month the players see in TWIS (practices,
// workouts, lessons, meetings, games and training phases), view only. Parents read it through the
// "(parent view)" rules; the Switchboard's parent "Calendar" switch closes it per team. Her video calls
// show too when they were booked to (user, 2026-11-14), each linking to the call.
export default function FamilyCalendarPage({ searchParams }: PageProps<"/family/calendar">) {
  return (
    <div className="flex flex-1 flex-col">
      <FamilyHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Suspense fallback={<Loading />}>
          <FamilyCalendar searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

async function FamilyCalendar({ searchParams }: Pick<PageProps<"/family/calendar">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { team: teamParam, month: monthParam } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("parent_home");
  const links = ((data ?? []) as { team_id: string; team_name: string; status: string }[]).filter((l) => l.status === "approved");
  const teams = [...new Map(links.map((l) => [l.team_id, { id: l.team_id, name: l.team_name }])).values()];
  const { data: offRows } = teams.length
    ? await supabase.from("team_features_off").select("team_id").eq("feature", "parent.calendar").in("team_id", teams.map((t) => t.id))
    : { data: [] };
  const closed = new Set((offRows ?? []).map((r) => r.team_id));
  const open = teams.filter((t) => !closed.has(t.id));
  const back = (
    <Link href="/family" className="text-sm font-semibold text-link hover:underline">
      <span aria-hidden="true">←</span> Family page
    </Link>
  );
  if (open.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <EmptyState>The team calendar shows here once your daughter&apos;s coach approves you.</EmptyState>
      </div>
    );
  }

  const team = pickTeam(open, teamParam);
  const today = todayISO();
  const month = monthOf(monthParam, today);
  const days = monthGrid(month);
  const [from, to] = [days[0], days[days.length - 1]];
  const [callFrom, callTo] = callRange(from, to);
  const [eventsResult, gamesResult, phasesResult, callsResult] = await Promise.all([
    supabase
      .from("team_events")
      .select("id, kind, title, event_date, start_time, end_time, location, notes, series_id")
      .eq("team_id", team.id)
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date")
      .order("start_time", { nullsFirst: true }),
    supabase
      .from("games")
      .select("id, game_date, start_time, venue, event_name, home_team_id, home:teams!home_team_id(name, short_name), away:teams!away_team_id(name, short_name)")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .gte("game_date", from)
      .lte("game_date", to),
    supabase.from("training_phases").select("name, kind, starts_on, ends_on").eq("team_id", team.id).lte("starts_on", to).gte("ends_on", from),
    // her video calls on this team (parents read their daughters' calls)
    supabase.from("video_calls").select(VIDEO_CALL_COLUMNS).eq("team_id", team.id).gte("starts_at", callFrom).lte("starts_at", callTo).order("starts_at"),
  ]);
  const teamEvents: CalEvent[] = (eventsResult.data ?? []).map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    date: e.event_date,
    start: hhmm(e.start_time),
    end: hhmm(e.end_time),
    location: e.location,
    notes: e.notes,
    seriesId: e.series_id,
    // who added it and the practice plan are for coaches
    byline: null,
    planId: null,
  }));
  const events = [...teamEvents, ...callEvents((callsResult.data ?? []) as VideoCallRow[], from, to, "family")];
  const games: CalGame[] = (gamesResult.data ?? []).map((g) => {
    const home = g.home_team_id === team.id;
    const opponent = home ? g.away : g.home;
    return {
      id: g.id,
      date: g.game_date,
      start: hhmm(g.start_time),
      label: `${home ? "vs" : "@"} ${opponent?.short_name || opponent?.name || "TBD"}`,
      place: [g.event_name, g.venue].filter(Boolean).join(" · ") || null,
    };
  });
  const phases = (phasesResult.data ?? []).map((p) => ({ name: p.name, testing: p.kind === "testing", startsOn: p.starts_on, endsOn: p.ends_on }));
  const link = (m: string) => `/family/calendar?team=${team.id}&month=${m}`;

  return (
    <div className="flex flex-col gap-6">
      {back}
      <TeamPicker teams={open} current={team.id} basePath="/family/calendar" />
      <CalendarView
        key={`${team.id}-${month}`}
        teamId={team.id}
        month={month}
        days={days}
        today={today}
        events={events}
        games={games}
        canEdit={false}
        phases={phases}
        heading={
          <div>
            <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">{monthLabel(month)}</h2>
            <p className="mt-1 text-sm text-muted">{team.name} · Practices, workouts, meetings and games. Tap one for the details.</p>
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
    </div>
  );
}
