import "server-only";
import { isoDate, oneOf, text } from "@/lib/form";
import { REPEATS, checkRecurrence, type Repeat } from "@/lib/recurrence";

// Team events (practices, workouts, lessons, meetings): added on the team page
// or in the Coaches Dugout calendar, shown in each player's TWIS. Only coaches
// and admins can change them (row-level security on team_events).

export const EVENT_KINDS = ["practice", "workout", "lesson", "meeting", "other"] as const;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

/** "17:30" from a time input, or null. */
export function timeOf(fd: FormData, name: string) {
  const value = text(fd, name);
  return value && TIME.test(value) ? value.slice(0, 5) : null;
}

/**
 * The dates a new event goes on: just its date, or every date of its repeat rule (`repeat`,
 * `repeat_days`, `repeat_until`; `lib/recurrence.ts`). A form with only "repeat_until" (older
 * pages) repeats weekly. Each date becomes its own event sharing a series_id.
 */
export function readRepeat(fd: FormData, first: string) {
  const until = isoDate(fd, "repeat_until");
  const repeat: Repeat = (oneOf(fd, "repeat", REPEATS) ?? (until ? "weekly" : "none"));
  const days = fd.getAll("repeat_days").map((d) => Number(d));
  return checkRecurrence(first, { repeat, days, until });
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
