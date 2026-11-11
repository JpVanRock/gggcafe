// Repeating calendar events (user, 2026-11-11: coaches add one-time or repeating events that show
// on every player's calendar). A rule turns the first date into every date of the series; each
// date becomes its own team_events row sharing a series_id. Days are Monday-first (0 = Monday,
// 6 = Sunday), like the calendar and TWIS. No imports, so it runs in unit tests and client code.

export const REPEATS = ["none", "daily", "weekly", "biweekly", "monthly"] as const;
export type Repeat = (typeof REPEATS)[number];
export const REPEAT_LABEL: Record<Repeat, string> = {
  none: "One time",
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_PLURAL = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"] as const;

/** The most dates one save can add, so a typo in the end date can't flood every player's week. */
export const MAX_OCCURRENCES = 150;

export type RepeatRule = { repeat: Repeat; days: number[]; until: string | null };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};

/** 0 = Monday … 6 = Sunday */
export function weekdayOf(iso: string) {
  return (toDate(iso).getUTCDay() + 6) % 7;
}

/** The days a weekly rule falls on: the chosen ones, else the first date's weekday. */
function ruleDays(first: string, days: number[]) {
  const clean = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return clean.length ? clean : [weekdayOf(first)];
}

/**
 * Every date of the series from `first` through `until` (both included). It stops one past
 * MAX_OCCURRENCES so the caller can tell the rule makes too many. A one-time event is just `first`.
 */
export function recurrenceDates(first: string, rule: RepeatRule): string[] {
  if (!ISO.test(first)) return [];
  if (rule.repeat === "none" || !rule.until || !ISO.test(rule.until) || rule.until < first) return [first];
  const until = rule.until;
  const out: string[] = [];
  const full = () => out.length > MAX_OCCURRENCES;

  if (rule.repeat === "monthly") {
    // the same day of the month; a month without it (the 31st in April) is skipped
    const [y, m, d] = first.split("-").map(Number);
    for (let i = 0; !full(); i++) {
      const date = new Date(Date.UTC(y, m - 1 + i, d));
      if (date.getUTCDate() !== d) continue;
      const iso = toIso(date);
      if (iso > until) break;
      out.push(iso);
    }
    return out;
  }

  const days = rule.repeat === "daily" ? [0, 1, 2, 3, 4, 5, 6] : ruleDays(first, rule.days);
  const every = rule.repeat === "biweekly" ? 2 : 1;
  const firstMonday = addDays(first, -weekdayOf(first));
  for (let date = first; date <= until && !full(); date = addDays(date, 1)) {
    if (!days.includes(weekdayOf(date))) continue;
    const week = Math.round((toDate(date).getTime() - toDate(firstMonday).getTime()) / (7 * 86_400_000));
    if (week % every === 0) out.push(date);
  }
  return out;
}

/** The dates to add, or what's wrong with the rule (and which field to mark). */
export function checkRecurrence(first: string, rule: RepeatRule): { dates: string[]; error: null } | { dates: null; error: string; field: string } {
  if (rule.repeat === "none") return { dates: [first], error: null };
  if (!rule.until) return { dates: null, error: "Pick the date the event stops repeating.", field: "repeat_until" };
  if (rule.until < first) return { dates: null, error: "The end date is before the first date.", field: "repeat_until" };
  const dates = recurrenceDates(first, rule);
  if (dates.length === 0) return { dates: null, error: "No dates match. Check the days and the end date.", field: "repeat_until" };
  if (dates.length > MAX_OCCURRENCES) {
    return { dates: null, error: `That's more than ${MAX_OCCURRENCES} dates. Pick an earlier end date.`, field: "repeat_until" };
  }
  return { dates, error: null };
}

const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const listOf = (items: string[]) => (items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** "Mondays and Wednesdays, every 2 weeks" / "Every day" / "Monthly on the 15th" */
export function repeatPhrase(first: string, rule: RepeatRule) {
  if (rule.repeat === "none") return "One time";
  if (rule.repeat === "daily") return "Every day";
  if (rule.repeat === "monthly") {
    const d = Number(first.slice(8));
    const suffix = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
    return `Monthly on the ${d}${suffix}`;
  }
  const days = listOf(ruleDays(first, rule.days).map((d) => DAY_PLURAL[d]));
  return rule.repeat === "biweekly" ? `${days}, every 2 weeks` : `${days}, every week`;
}

/** What a save will add: "12 events · Mondays and Wednesdays, every week · Jan 5 – Feb 11". */
export function repeatSummary(first: string, rule: RepeatRule) {
  const check = checkRecurrence(first, rule);
  if (check.error !== null) return check.error;
  const { dates } = check;
  if (dates.length === 1) return `1 event · ${shortDate.format(toDate(dates[0]))}`;
  return `${dates.length} events · ${repeatPhrase(first, rule)} · ${shortDate.format(toDate(dates[0]))} – ${shortDate.format(toDate(dates[dates.length - 1]))}`;
}
