// Video calls as calendar entries (user, 2026-11-14): the Coaches Dugout, family and mentor calendars
// list a call on its day, in the site's time zone, and opening it links to the call page. Which
// calendars show a call was picked when it was booked (video_calls.calendars; the host's always does).
import type { CalEvent } from "@/app/(staff)/dugout/calendar/calendar";
import type { VideoCallRow } from "@/components/video-calls";
import { APP_TIME_ZONE } from "@/lib/dates";
import { callDateAndClock, callEnds, type CallCalendar } from "@/lib/video-calls";

/** Calls not cancelled, on `calendar` (or every call, for the host's own calendar), between `from` and `to`. */
export function callEvents(rows: VideoCallRow[], from: string, to: string, calendar: CallCalendar | "host"): CalEvent[] {
  return rows.flatMap((c) => {
    if (c.cancelled_at || (calendar !== "host" && !c.calendars.includes(calendar))) return [];
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
        notes: `${c.topic} · with ${c.host_name}`,
        seriesId: null,
        byline: null,
        planId: null,
        href: `/calls/${c.id}`,
      },
    ];
  });
}

/** The first and last moment to ask the database for, a day either side for time zones. */
export function callRange(from: string, to: string): [string, string] {
  const day = 24 * 60 * 60 * 1000;
  return [new Date(new Date(`${from}T00:00:00Z`).getTime() - day).toISOString(), new Date(new Date(`${to}T23:59:59Z`).getTime() + day).toISOString()];
}
