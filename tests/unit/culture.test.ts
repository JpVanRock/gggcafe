// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { GOAL_PHASES, cleanLines, goalProgress, pledgeStatus, sortGoals } from "../../src/lib/culture.ts";

test("goal progress", () => {
  assert.equal(goalProgress({ target: 20, current: 5, achieved_at: null }), 25);
  assert.equal(goalProgress({ target: 20, current: 40, achieved_at: null }), 100);
  assert.equal(goalProgress({ target: null, current: 3, achieved_at: null }), null);
  assert.equal(goalProgress({ target: null, current: null, achieved_at: "2027-04-01" }), 100);
});

test("goals sort by season phase, then position", () => {
  const goals = [
    { phase: "season", position: 0, title: "c" },
    { phase: "preseason", position: 1, title: "b" },
    { phase: "preseason", position: 0, title: "a" },
  ] as { phase: (typeof GOAL_PHASES)[number]; position: number; title: string }[];
  assert.deepEqual(sortGoals(goals).map((g) => g.title), ["a", "b", "c"]);
});

test("pledge lines follow the current standards", () => {
  const lines = cleanLines({ Hustle: "  I will sprint on and off  ", Old: "gone", Respect: "" }, ["Hustle", "Respect"]);
  assert.deepEqual(lines, { Hustle: "I will sprint on and off" });
  assert.deepEqual(pledgeStatus({ lines, signed_at: "2026-11-09" }, ["Hustle", "Respect"]), { written: 1, total: 2, signed: true, complete: false });
  assert.equal(pledgeStatus({ lines: { Hustle: "x", Respect: "y" }, signed_at: "2026-11-09" }, ["Hustle", "Respect"]).complete, true);
  assert.equal(pledgeStatus(null, ["Hustle"]).signed, false);
});
