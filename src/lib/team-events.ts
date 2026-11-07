import "server-only";
import { isoDate, oneOf, text } from "@/lib/form";

// Team events (practices, workouts, lessons, meetings): added on the team page
// or in the Coaches Dugout calendar, shown in each player's TWIS. Only coaches
// and admins can change them (row-level security on team_events).

export const EVENT_KINDS = ["practice", "workout", "lesson", "meeting", "other"] as const;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
export const MAX_REPEATS = 30;

/** "17:30" from a time input, or null. */
export function timeOf(fd: FormData, name: string) {
  const value = text(fd, name);
  return value && TIME.test(value) ? value.slice(0, 5) : null;
}

/** Weekly dates from `first` through `until` (inclusive), capped so a typo can't flood the schedule. */
export function weeklyDates(first: string, until: string | null) {
  const dates = [first];
  while (until && dates.length < MAX_REPEATS) {
    const next = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 7);
    const iso = next.toISOString().slice(0, 10);
    if (iso > until) break;
    dates.push(iso);
  }
  return dates;
}

/** The event fields from a form, or an error message. */
export function readEventForm(fd: FormData) {
  const event_date = isoDate(fd, "event_date");
  if (!event_date) return { error: "Pick a date." } as const;
  const start_time = timeOf(fd, "start_time");
  const end_time = timeOf(fd, "end_time");
  if (start_time && end_time && end_time <= start_time) return { error: "The end time is before the start time." } as const;
  const title = text(fd, "title");
  if ((title ?? "").length > 120) return { error: "Keep the title to 120 characters." } as const;
  return {
    error: null,
    event_date,
    values: {
      kind: oneOf(fd, "kind", EVENT_KINDS) ?? "practice",
      title,
      start_time,
      end_time,
      location: text(fd, "location"),
      notes: text(fd, "notes"),
    },
  } as const;
}
