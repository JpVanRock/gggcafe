// Plain calendar-date helpers (YYYY-MM-DD strings, weeks start Monday).
// Math is done in UTC so daylight-saving changes can't shift a day.

/** The team's time zone decides what "today" and "this week" mean. */
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE ?? "America/New_York";

export const WEEKDAYS = [
  { n: 1, short: "Mon", long: "Monday" },
  { n: 2, short: "Tue", long: "Tuesday" },
  { n: 3, short: "Wed", long: "Wednesday" },
  { n: 4, short: "Thu", long: "Thursday" },
  { n: 5, short: "Fri", long: "Friday" },
  { n: 6, short: "Sat", long: "Saturday" },
  { n: 7, short: "Sun", long: "Sunday" },
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = toUTC(value);
  return !Number.isNaN(d.getTime()) && fromUTC(d) === value;
}

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Today's date in the team's time zone. Only call at request time. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(iso: string, days: number) {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/** 1 = Monday ... 7 = Sunday */
export function isoWeekday(iso: string) {
  const day = toUTC(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The Monday of the week containing this date. */
export function weekStart(iso: string) {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function weekDates(monday: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const dayOnly = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" });
const longDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });

/** "Tue, Sep 15" */
export function formatDay(iso: string) {
  return dayFormat.format(toUTC(iso));
}

/** "September 15, 2026" */
export function formatLongDate(iso: string) {
  return longDate.format(toUTC(iso));
}

/** A timestamp as a long date in the team's time zone: "November 8, 2026". */
export function formatLongDateAt(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, month: "long", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

/** "Sep 14 – 20" or "Sep 28 – Oct 4" */
export function formatWeekRange(monday: string) {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  return `${monthDay.format(toUTC(monday))} – ${(sameMonth ? dayOnly : monthDay).format(toUTC(sunday))}`;
}

/** "17:30:00" → "5:30 PM" */
export function formatTime(time: string | null | undefined) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
