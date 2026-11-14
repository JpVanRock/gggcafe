import type { Metadata } from "next";
import Link from "next/link";
import { dugoutCanEdit, requireDugoutPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pillQuietClass } from "@/components/ui";
import { formatLongDate, todayISO } from "@/lib/dates";
import { monthGrid, monthLabel, monthOf, shiftMonth, type EventKind } from "@/lib/dugout";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";
import { CalendarView, type CalEvent, type CalGame } from "./calendar";
import { OffseasonForm, OffseasonPanel } from "./offseason";
import { isHeadCoachRole } from "@/lib/roles";
import { loadRoster } from "@/lib/roster";
import { RECENT_LIMIT } from "@/components/ui";
import { VIDEO_CALL_COLUMNS, VideoCallList, type VideoCallRow } from "@/components/video-calls";
import { VideoCallForm } from "@/components/video-call-form";
import { zoomConfigured } from "@/lib/zoom";
import { recentSinceISO } from "@/lib/video-calls";
import { callEvents, callRange } from "@/lib/call-events";

export const metadata: Metadata = { title: "Calendar · Coaches Dugout · GGG.Cafe" };

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

export default async function CalendarPage({ searchParams }: PageProps<"/dugout/calendar">) {
  // staff, or a team admin (a parent the head coach named; user, 2026-11-12) for their teams
  const access = await requireDugoutPage("calendar");
  const editor = dugoutCanEdit(access, "calendar");
  const coach = access.role !== null;
  const { team: teamParam, month: monthParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam, access.adminTeamIds);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
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
    coach ? supabase.from("staff").select("user_id, display_name") : Promise.resolve({ data: [] }),
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
  // events a team admin added or changed (they aren't on the staff list)
  if (coach) {
    const { data: admins } = await supabase.from("team_admins").select("user_id").eq("team_id", team.id);
    for (const a of admins ?? []) if (!names.has(a.user_id)) names.set(a.user_id, "the team admin");
  }
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
  const games: CalGame[] = ((gamesResult.data ?? []) as GameRow[]).map((g) => {
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
  // video calls (user, 2026-11-12): coaches see every call on the team; head coaches book them
  const headCoach = isHeadCoachRole(access.role);
  const [callFrom, callTo] = callRange(from, to);
  const [{ data: videoAccess }, { data: callRows }, roster, { data: monthCallRows }] = coach
    ? await Promise.all([
        supabase.from("team_video_access").select("mentors_on").eq("team_id", team.id).maybeSingle(),
        supabase
          .from("video_calls")
          .select(VIDEO_CALL_COLUMNS)
          .eq("team_id", team.id)
          .gte("starts_at", recentSinceISO())
          .order("starts_at")
          .limit(RECENT_LIMIT),
        headCoach ? loadRoster(supabase, team.id, { order: "name" }) : Promise.resolve([]),
        // this month's calls on the grid (user, 2026-11-14): the ones booked to show on the Dugout calendar
        supabase.from("video_calls").select(VIDEO_CALL_COLUMNS).eq("team_id", team.id).gte("starts_at", callFrom).lte("starts_at", callTo).order("starts_at"),
      ])
    : [{ data: null }, { data: [] }, [], { data: [] }];
  const calls = (callRows ?? []) as VideoCallRow[];
  const gridEvents = [...events, ...callEvents((monthCallRows ?? []) as VideoCallRow[], from, to, "coaches")];

  return (
    <div className="flex flex-col gap-6">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/calendar" />
      <CalendarView
        key={`${team.id}-${month}`}
        teamId={team.id}
        month={month}
        days={days}
        today={today}
        events={gridEvents}
        games={games}
        canEdit={editor}
        offseason={offseason ? { startsOn: offseason.starts_on, endsOn: offseason.ends_on } : null}
        phases={phases}
        heading={
          <div>
            <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">{monthLabel(month)}</h2>
            <p className="mt-1 text-sm text-muted">
              {team.name} · Everything here shows on every player&apos;s calendar (TWIS).
              {!editor && " Only coaches and admins can change it."}
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
      >
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
          {editor && coach && <OffseasonForm key={`${team.id}-${offseason?.starts_on}-${offseason?.ends_on}`} teamId={team.id} startsOn={offseason?.starts_on ?? null} endsOn={offseason?.ends_on ?? null} />}
        </OffseasonPanel>
      </CalendarView>
      {coach && (
        <section aria-labelledby="video-calls" className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-5">
          <div>
            <h2 id="video-calls" className="font-display text-2xl leading-none font-bold tracking-wide text-highlight uppercase">
              Video calls
            </h2>
            <p className="mt-2 text-sm text-muted">
              {videoAccess
                ? `Zoom calls with one player, held on GGG.Cafe. Her parents are told and can join; head coaches can drop in; nothing is recorded. Mentors: ${videoAccess.mentors_on ? "on" : "off"} (the Switchboard).`
                : `Off for ${team.name}. Only a site admin can turn video calls on for a team (the Switchboard).`}
            </p>
          </div>
          {videoAccess && headCoach && (zoomConfigured() ? <VideoCallForm teamId={team.id} players={roster.map((p) => ({ id: p.id, name: p.name }))} /> : (
            <p className="text-sm">Zoom isn&apos;t connected yet. A site admin adds the Zoom keys in Vercel first.</p>
          ))}
          <VideoCallList calls={calls} showPlayer canCancel={() => headCoach} empty={videoAccess ? "No calls booked in the last 30 days or ahead." : undefined} />
        </section>
      )}
      {editor && (
        <p className="text-xs text-muted">
          + Event adds a practice, workout, lesson or meeting, one time or repeating (+ on a day starts it on that day). Tap an event to change or remove it.
        </p>
      )}
    </div>
  );
}
