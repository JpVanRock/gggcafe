// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoriesFor, evaluateAchievements, streaks, weeklyStats, type Check, type Routine } from "../../src/lib/achievements.ts";

// Week of Mon 2026-09-07 ... Sun 2026-10-04 (4 weeks)
const tee: Routine = { id: "tee", category: "hitting", days: [1, 3, 5], starts_on: "2026-09-07", ends_on: null };
const stretch: Routine = { id: "stretch", category: "stretching", days: [], starts_on: "2026-09-07", ends_on: null };
const routines = [tee, stretch];

const checks = (list: [string, string][]): Check[] => list.map(([activity_id, on_date]) => ({ activity_id, on_date }));

test("weekly plan counts each weekday and once-a-week routines", () => {
  const weeks = weeklyStats(routines, [], "2026-09-09");
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].scheduled, 4); // Mon/Wed/Fri + once a week
});

test("routines don't count before they start or after they end", () => {
  const late: Routine = { id: "late", category: "workout", days: [1, 2, 3, 4, 5, 6, 7], starts_on: "2026-09-10", ends_on: "2026-09-11" };
  const weeks = weeklyStats([late], [], "2026-09-13");
  assert.equal(weeks[0].scheduled, 2); // Thu + Fri only
});

test("perfect week and first rep unlock on the right dates", () => {
  const c = checks([["tee", "2026-09-07"], ["tee", "2026-09-09"], ["stretch", "2026-09-10"], ["tee", "2026-09-11"]]);
  const result = evaluateAchievements({ routines, checks: c, today: "2026-09-20", positions: ["SS"] });
  const get = (key: string) => result.find((r) => r.def.key === key)!;
  assert.equal(get("first_rep").unlockedOn, "2026-09-07");
  assert.equal(get("perfect_week").unlockedOn, "2026-09-11");
  assert.equal(get("double_digits").unlockedOn, null);
  assert.equal(get("double_digits").current, 4);
});

test("a 3-week streak needs 80% each week; a weak week resets it", () => {
  // Plan is 4 per week. Weeks 1-2: 4/4. Week 3: 2/4 (50%). Weeks 4-6: 4/4, 4/4, 4/4.
  const full = (mon: string, wed: string, fri: string, any: string): [string, string][] => [["tee", mon], ["tee", wed], ["tee", fri], ["stretch", any]];
  const c = checks([
    ...full("2026-09-07", "2026-09-09", "2026-09-11", "2026-09-12"),
    ...full("2026-09-14", "2026-09-16", "2026-09-18", "2026-09-19"),
    ["tee", "2026-09-21"], ["tee", "2026-09-23"],
    ...full("2026-09-28", "2026-09-30", "2026-10-02", "2026-10-03"),
    ...full("2026-10-05", "2026-10-07", "2026-10-09", "2026-10-10"),
    ...full("2026-10-12", "2026-10-14", "2026-10-16", "2026-10-17"),
  ]);
  const weeks = weeklyStats(routines, c, "2026-10-18");
  const s = streaks(weeks, "2026-10-18");
  assert.equal(s.best, 3);
  assert.equal(s.current, 3);
  const hot = evaluateAchievements({ routines, checks: c, today: "2026-10-18", positions: [] }).find((r) => r.def.key === "hot_streak")!;
  assert.equal(hot.unlockedOn, "2026-10-17");
});

test("this week doesn't break a streak before it's over", () => {
  const c = checks([
    ["tee", "2026-09-07"], ["tee", "2026-09-09"], ["tee", "2026-09-11"], ["stretch", "2026-09-12"],
    ["tee", "2026-09-14"], // this week: 1 of 4 so far, on Monday
  ]);
  const s = streaks(weeklyStats(routines, c, "2026-09-14"), "2026-09-14");
  assert.equal(s.current, 1);
});

test("weeks with nothing planned don't break a streak", () => {
  const ended: Routine = { ...tee, ends_on: "2026-09-13" };
  const restart: Routine = { id: "tee2", category: "hitting", days: [1], starts_on: "2026-09-28", ends_on: null };
  const c = checks([
    ["tee", "2026-09-07"], ["tee", "2026-09-09"], ["tee", "2026-09-11"],
    ["tee2", "2026-09-28"],
  ]);
  const s = streaks(weeklyStats([ended, restart], c, "2026-10-04"), "2026-10-04");
  assert.equal(s.best, 2);
});

test("pitching and catching only for pitchers and catchers", () => {
  assert.deepEqual(categoriesFor(["SS"]), ["workout", "stretching", "hitting", "fielding"]);
  assert.ok(categoriesFor(["P"]).includes("pitching"));
  assert.ok(!categoriesFor(["P"]).includes("catching"));
  const keys = (pos: string[]) => evaluateAchievements({ routines: [], checks: [], today: "2026-09-07", positions: pos }).map((r) => r.def.key);
  assert.ok(!keys(["SS"]).includes("ace"));
  assert.ok(keys(["P"]).includes("ace"));
  assert.ok(keys(["C"]).includes("brick_wall"));
});

test("category achievements only count that category", () => {
  const c = checks(Array.from({ length: 20 }, (_, i) => ["stretch", `2026-09-${String(7 + (i % 20)).padStart(2, "0")}`] as [string, string]));
  const result = evaluateAchievements({ routines, checks: c, today: "2026-10-01", positions: [] });
  assert.equal(result.find((r) => r.def.key === "loose_and_ready")!.current, 20);
  assert.equal(result.find((r) => r.def.key === "barrel_buster")!.current, 0);
});
