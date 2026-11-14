// Video calls (user, 2026-11-12; docs/features/video-calls.md): mentors and head coaches schedule
// a Zoom call with one player, held inside the site. Rules shared by the pages, the actions and
// the unit tests. No imports, so client components can use it.

/** How long a call can be booked for. */
export const CALL_MINUTES = [15, 30, 45, 60, 90] as const;
export type CallMinutes = (typeof CALL_MINUTES)[number];
export const TOPIC_MAX = 120;
/** How far ahead a call can be booked. */
export const BOOK_AHEAD_DAYS = 90;
/** The call opens this long before it starts, and stays open this long after it should end. */
export const OPENS_EARLY_MINUTES = 10;
export const STAYS_OPEN_MINUTES = 15;

export type CallTimes = { starts_at: string; minutes: number; cancelled_at: string | null };
export type CallState = "cancelled" | "upcoming" | "open" | "over";

const MINUTE = 60_000;

export function callEnds(call: Pick<CallTimes, "starts_at" | "minutes">): Date {
  return new Date(new Date(call.starts_at).getTime() + call.minutes * MINUTE);
}

/** Where a call stands: open from 10 minutes before it starts until 15 minutes after it should end. */
export function callState(call: CallTimes, now: Date = new Date()): CallState {
  if (call.cancelled_at) return "cancelled";
  const start = new Date(call.starts_at).getTime();
  if (now.getTime() < start - OPENS_EARLY_MINUTES * MINUTE) return "upcoming";
  if (now.getTime() > callEnds(call).getTime() + STAYS_OPEN_MINUTES * MINUTE) return "over";
  return "open";
}

/** Still ahead or happening now (not cancelled, not over). */
export function isComing(call: CallTimes, now: Date = new Date()): boolean {
  const state = callState(call, now);
  return state === "upcoming" || state === "open";
}

export function isCallMinutes(value: unknown): value is CallMinutes {
  return CALL_MINUTES.some((m) => String(m) === String(value));
}

export type CleanCall = { startsAt: string; minutes: CallMinutes; topic: string };

/**
 * A call from the form: the start (an ISO time the browser worked out from the date and time
 * she picked), the length and what it's about. The start must be ahead, within 90 days.
 */
export function cleanCallInput(
  input: { startsAt: unknown; minutes: unknown; topic: unknown },
  now: Date = new Date(),
): { ok: true; call: CleanCall } | { ok: false; field: "starts_at" | "minutes" | "topic"; error: string } {
  const raw = typeof input.startsAt === "string" ? input.startsAt.trim() : "";
  const start = raw ? new Date(raw) : null;
  if (!start || Number.isNaN(start.getTime())) return { ok: false, field: "starts_at", error: "Pick the day and time." };
  if (start.getTime() < now.getTime() + 5 * MINUTE) return { ok: false, field: "starts_at", error: "Pick a time that's still ahead." };
  if (start.getTime() > now.getTime() + BOOK_AHEAD_DAYS * 24 * 60 * MINUTE)
    return { ok: false, field: "starts_at", error: `Book calls up to ${BOOK_AHEAD_DAYS} days ahead.` };
  if (!isCallMinutes(input.minutes)) return { ok: false, field: "minutes", error: "Pick how long the call is." };
  const topic = typeof input.topic === "string" ? input.topic.trim().replace(/\s+/g, " ") : "";
  if (!topic) return { ok: false, field: "topic", error: "Say what the call is about." };
  if (topic.length > TOPIC_MAX) return { ok: false, field: "topic", error: `Keep it to ${TOPIC_MAX} characters.` };
  return { ok: true, call: { startsAt: start.toISOString(), minutes: Number(input.minutes) as CallMinutes, topic } };
}

/** "Tue, Nov 17" in the team's time zone. */
export function formatCallDay(startsAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(startsAt));
}

/** "7:00 PM" in the team's time zone. */
export function formatCallClock(startsAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(startsAt));
}

/** The call's day ("2026-11-17") and 24-hour clock ("19:00") in the team's time zone, for calendars. */
export function callDateAndClock(startsAt: string, timeZone: string): { date: string; clock: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(startsAt));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, clock: `${part("hour")}:${part("minute")}` };
}

/** "Tue, Nov 17 · 7:00 PM" in the team's time zone. */
export function formatCallTime(startsAt: string, timeZone: string): string {
  return `${formatCallDay(startsAt, timeZone)} · ${formatCallClock(startsAt, timeZone)}`;
}

/** How each state reads on the page. */
export const CALL_STATE_LABEL: Record<CallState, string> = {
  cancelled: "Cancelled",
  upcoming: "Scheduled",
  open: "Open now",
  over: "Done",
};

/** For "still ahead or happening now" queries: calls that started up to three hours ago or later. */
export function comingSinceISO(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 60 * MINUTE).toISOString();
}

/** The Dugout Calendar's list: the last 30 days and everything ahead. */
export function recentSinceISO(now: Date = new Date()): string {
  return new Date(now.getTime() - 30 * 24 * 60 * MINUTE).toISOString();
}
