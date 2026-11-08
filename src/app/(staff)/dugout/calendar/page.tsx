import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Loading, pillQuietClass } from "@/components/ui";
import { formatLongDate, todayISO } from "@/lib/dates";
import { monthGrid, monthLabel, monthOf, shiftMonth, type EventKind } from "@/lib/dugout";
import { loadOwnTeams } from "../data";
import { TeamPicker } from "../team-picker";
import { CalendarView, type CalEvent, type CalGame } from "./calendar";
import { OffseasonForm, OffseasonPanel } from "./offseason";

export const metadata: Metadata = { title: "Calendar · Coaches Dugout · GGG.Cafe" };

export default function CalendarPage({ searchParams }: PageProps<"/dugout/calendar">) {
  return (
    <Suspense fallback={<Loading />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

type EventRow = {
  id: string;
  kind: EventKind;
  title: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  series_id: string | null;
  created_by: string | null;
  updated_by: string | null;
};
type GameRow = {
  id: string;
  game_date: string;
  start_time: string | null;
  venue: string | null;
  event_name: string | null;
  home_team_id: string;
  home: { name: string; short_name: string | null } | null;
  away: { name: string; short_name: string | null } | null;
};

async function Calendar({ searchParams }: Pick<PageProps<"/dugout/calendar">, "searchParams">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam, month: monthParam } = await searchParams;
  const supabase = await createClient();
  const teams = await loadOwnTeams(supabase);
  if (teams.length === 0) {
    return (
      <EmptyState>
        Add your team on the{" "}
        <Link href="/teams" className="text-pink hover:underline">
          Teams
        </Link>{" "}
        page first (mark it as one of our teams).
      </EmptyState>
    );
  }
  const team = teams.find((t) => t.id === teamParam) ?? teams[0];
  const today = todayISO();
  const month = monthOf(monthParam, today);
  const days = monthGrid(month);
  const [from, to] = [days[0], days[days.length - 1]];

  const [eventsResult, gamesResult, plansResult, staffResult, offseasonResult, phasesResult] = await Promise.all([
    supabase
      .from("team_events")
      .select("id, kind, title, event_date, start_time, end_time, location, notes, series_id, created_by, updated_by")
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
    supabase.from("practice_plans").select("id, practice_date").eq("team_id", team.id).gte("practice_date", from).lte("practice_date", to),
    supabase.from("staff").select("user_id, display_name"),
    supabase.from("team_offseason").select("starts_on, ends_on").eq("team_id", team.id).maybeSingle(),
    supabase.from("training_phases").select("name, kind, starts_on, ends_on").eq("team_id", team.id).lte("starts_on", to).gte("ends_on", from),
  ]);
  // training phases (Coaches Dugout → Training): each one's first day is labeled; testing weeks are marked
  const phases = ((phasesResult.data ?? []) as { name: string; kind: string; starts_on: string; ends_on: string }[]).map((p) => ({
    name: p.name,
    testing: p.kind === "testing",
    startsOn: p.starts_on,
    endsOn: p.ends_on,
  }));
  const offseason = (offseasonResult.data as { starts_on: string; ends_on: string | null } | null) ?? null;

  const names = new Map(((staffResult.data ?? []) as { user_id: string; display_name: string }[]).map((s) => [s.user_id, s.display_name]));
  const planByDate = new Map(((plansResult.data ?? []) as { id: string; practice_date: string }[]).map((p) => [p.practice_date, p.id]));
  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

  const events: CalEvent[] = ((eventsResult.data ?? []) as EventRow[]).map((e) => {
    const changed = e.updated_by && names.get(e.updated_by);
    const added = e.created_by && names.get(e.created_by);
    return {
      id: e.id,
      kind: e.kind,
      title: e.title,
      date: e.event_date,
      start: hhmm(e.start_time),
      end: hhmm(e.end_time),
      location: e.location,
      notes: e.notes,
      seriesId: e.series_id,
      byline: changed ? `Changed by ${changed}` : added ? `Added by ${added}` : null,
      planId: e.kind === "practice" ? (planByDate.get(e.event_date) ?? null) : null,
    };
  });
  const games: CalGame[] = ((gamesResult.data ?? []) as unknown as GameRow[]).map((g) => {
    const home = g.home_team_id === team.id;
    const opp = home ? g.away : g.home;
    return {
      id: g.id,
      date: g.game_date,
      start: hhmm(g.start_time),
      label: `${home ? "vs" : "@"} ${opp?.short_name || opp?.name || "TBD"}`,
      place: [g.event_name, g.venue].filter(Boolean).join(" · ") || null,
    };
  });

  const link = (m: string) => `/dugout/calendar?team=${team.id}&month=${m}`;

  return (
    <div className="flex flex-col gap-6">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/calendar" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">{monthLabel(month)}</h2>
          <p className="mt-1 text-sm text-muted">
            {team.name} · Everything here shows in each player&apos;s TWIS.
            {!editor && " Only coaches and admins can change it."}
          </p>
        </div>
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
      </div>
      <OffseasonPanel
        status={
          offseason
            ? offseason.ends_on
              ? `${formatLongDate(offseason.starts_on)} – ${formatLongDate(offseason.ends_on)}`
              : `Started ${formatLongDate(offseason.starts_on)} · no end date yet`
            : "Not set. The players' Leaderboard opens once you set a start date."
        }
      >
        <p className="text-xs text-muted">Only sessions and unlocks between these dates count on the players&apos; Leaderboard and for Player of the Week.</p>
        {editor && <OffseasonForm key={`${team.id}-${offseason?.starts_on}-${offseason?.ends_on}`} teamId={team.id} startsOn={offseason?.starts_on ?? null} endsOn={offseason?.ends_on ?? null} />}
      </OffseasonPanel>
      <CalendarView
        key={`${team.id}-${month}`}
        teamId={team.id}
        month={month}
        days={days}
        today={today}
        events={events}
        games={games}
        canEdit={editor}
        offseason={offseason ? { startsOn: offseason.starts_on, endsOn: offseason.ends_on } : null}
        phases={phases}
      />
      {editor && <p className="text-xs text-muted">Tap + on a day to add a practice, workout, lesson or meeting. Tap an event to change or remove it.</p>}
    </div>
  );
}
