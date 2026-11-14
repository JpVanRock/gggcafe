import "server-only";
// A mentor's calendar entries for a date range (user, 2026-11-13): the training she put on her
// players' weeks, the video calls she booked, and her players' team practices, events and games
// (mentor_calendar(): mentors can't read the team schedule tables themselves). The calendar page and
// the mentor menu's Coming up both use it.
import type { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE, addDays } from "@/lib/dates";
import { EVENT_KINDS, type EventKind } from "@/lib/dugout";
import { trainingDates } from "@/lib/mentors";
import { callDateAndClock, callEnds } from "@/lib/video-calls";
import type { ComingUpItem } from "@/lib/family";
import { VIDEO_CALL_COLUMNS, type VideoCallRow } from "@/components/video-calls";
import type { CalEvent, CalGame } from "@/app/(staff)/dugout/calendar/calendar";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadMentorCalendar(
  supabase: Supabase,
  mentorId: string,
  nameOf: (playerId: string) => string,
  from: string,
  to: string,
): Promise<{ events: CalEvent[]; games: CalGame[] }> {
  const [{ data: trainingRows }, { data: callRows }, { data: teamRows }] = await Promise.all([
    supabase
      .from("player_activities")
      .select("id, player_id, title, details, days, starts_on, ends_on")
      .eq("source", "mentor")
      .eq("created_by", mentorId)
      .lte("starts_on", to)
      .gte("ends_on", from),
    // a day either side, for time zones
    supabase
      .from("video_calls")
      .select(VIDEO_CALL_COLUMNS)
      .eq("host_id", mentorId)
      .is("cancelled_at", null)
      .gte("starts_at", `${addDays(from, -1)}T00:00:00Z`)
      .lte("starts_at", `${addDays(to, 1)}T23:59:59Z`)
      .order("starts_at"),
    // her players' team practices, events and games (nothing for a mentor not approved yet)
    supabase.rpc("mentor_calendar", { p_from: from, p_to: to }),
  ]);
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
      byline: `Your training · for ${who}`,
      planId: null,
    }));
  });

  // the team schedule: practices and other events, and games; with more than one team, each says whose
  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);
  const schedule = teamRows ?? [];
  const manyTeams = new Set(schedule.map((r) => r.team_id)).size > 1;
  const whose = (team: string, text: string) => (manyTeams ? `${team}: ${text}` : text);
  const teamEvents: CalEvent[] = schedule.flatMap((r) => {
    const kind = EVENT_KINDS.find((k) => k === r.kind);
    if (r.item !== "event" || !kind) return [];
    return [
      {
        id: r.id,
        kind: kind as EventKind,
        title: manyTeams ? whose(r.team_name, r.title || kind) : r.title,
        date: r.on_date,
        start: hhmm(r.start_time),
        end: hhmm(r.end_time),
        location: r.place,
        notes: r.notes,
        seriesId: null,
        byline: `${r.team_name} team calendar`,
        planId: null,
      },
    ];
  });
  const games: CalGame[] = schedule
    .filter((r) => r.item === "game")
    .map((r) => ({ id: r.id, date: r.on_date, start: hhmm(r.start_time), label: whose(r.team_name, r.title), place: r.place }));
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

  return { events: [...teamEvents, ...training, ...calls], games };
}

/** The same entries as "Coming up" lines (training and team events, calls, games), by day and time. */
export function asComingUp({ events, games }: { events: CalEvent[]; games: CalGame[] }): ComingUpItem[] {
  return [
    ...events.map((e) => ({
      key: `event-${e.id}`,
      teamId: "",
      date: e.date,
      start: e.start,
      title: e.title || (e.kind === "practice" ? "Practice" : "Team event"),
      place: e.location,
      game: false,
    })),
    ...games.map((g) => ({ key: `game-${g.id}`, teamId: "", date: g.date, start: g.start, title: g.label, place: g.place, game: true })),
  ];
}
