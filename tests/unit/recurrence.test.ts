// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_OCCURRENCES, checkRecurrence, recurrenceDates, repeatPhrase, repeatSummary, weekdayOf } from "../../src/lib/recurrence.ts";

test("weekdays are Monday-first", () => {
  assert.equal(weekdayOf("2026-11-09"), 0); // Monday
  assert.equal(weekdayOf("2026-11-15"), 6); // Sunday
});

test("a one-time event is just its date", () => {
  assert.deepEqual(recurrenceDates("2026-11-12", { repeat: "none", days: [], until: "2026-12-31" }), ["2026-11-12"]);
  assert.deepEqual(checkRecurrence("2026-11-12", { repeat: "none", days: [], until: null }), { dates: ["2026-11-12"], error: null });
});

test("every week, on the first date's weekday by default", () => {
  assert.deepEqual(recurrenceDates("2026-11-12", { repeat: "weekly", days: [], until: "2026-12-03" }), [
    "2026-11-12", "2026-11-19", "2026-11-26", "2026-12-03",
  ]);
});

test("every week on chosen days (Mon and Wed), starting from the first date", () => {
  // first date is a Tuesday: the series starts on that Wednesday
  assert.deepEqual(recurrenceDates("2026-11-10", { repeat: "weekly", days: [0, 2], until: "2026-11-23" }), [
    "2026-11-11", "2026-11-16", "2026-11-18", "2026-11-23",
  ]);
});

test("every 2 weeks counts weeks from the first date's week", () => {
  assert.deepEqual(recurrenceDates("2026-11-09", { repeat: "biweekly", days: [0, 3], until: "2026-12-10" }), [
    "2026-11-09", "2026-11-12", "2026-11-23", "2026-11-26", "2026-12-07", "2026-12-10",
  ]);
});

test("every day and every month (a month without the day is skipped)", () => {
  assert.equal(recurrenceDates("2026-11-28", { repeat: "daily", days: [], until: "2026-12-04" }).length, 7);
  assert.deepEqual(recurrenceDates("2027-01-31", { repeat: "monthly", days: [], until: "2027-05-31" }), [
    "2027-01-31", "2027-03-31", "2027-05-31",
  ]);
});

test("the checks: an end date, after the first, not too many dates, at least one", () => {
  assert.equal(checkRecurrence("2026-11-12", { repeat: "weekly", days: [], until: null }).error, "Pick the date the event stops repeating.");
  assert.equal(checkRecurrence("2026-11-12", { repeat: "weekly", days: [], until: "2026-11-01" }).error, "The end date is before the first date.");
  const flood = checkRecurrence("2026-01-01", { repeat: "daily", days: [], until: "2027-12-31" });
  assert.equal(flood.error, `That's more than ${MAX_OCCURRENCES} dates. Pick an earlier end date.`);
  assert.equal(flood.dates, null);
  // a Tuesday start, Mondays only, ending that Saturday: nothing matches
  assert.equal(checkRecurrence("2026-11-10", { repeat: "weekly", days: [0], until: "2026-11-14" }).error, "No dates match. Check the days and the end date.");
  // exactly the cap is fine
  const daily = checkRecurrence("2026-01-01", { repeat: "daily", days: [], until: "2026-05-30" });
  assert.equal(daily.dates?.length, MAX_OCCURRENCES);
});

test("the line the form shows", () => {
  assert.equal(repeatPhrase("2026-11-09", { repeat: "weekly", days: [0, 2, 4], until: null }), "Mondays, Wednesdays and Fridays, every week");
  assert.equal(repeatPhrase("2026-11-22", { repeat: "monthly", days: [], until: null }), "Monthly on the 22nd");
  assert.equal(repeatSummary("2026-11-09", { repeat: "weekly", days: [0, 2], until: "2026-11-30" }), "7 events · Mondays and Wednesdays, every week · Nov 9 – Nov 30");
});
