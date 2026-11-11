// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLEDGE_KEY, PLEDGE_MAX, cleanPledge, goalProgress, pledgeLine, pledgeStatus, sortGoals } from "../../src/lib/culture.ts";

test("goal progress", () => {
  assert.equal(goalProgress({ target: 20, current: 5, achieved_at: null }), 25);
  assert.equal(goalProgress({ target: 20, current: 40, achieved_at: null }), 100);
  assert.equal(goalProgress({ target: null, current: 3, achieved_at: null }), null);
  assert.equal(goalProgress({ target: null, current: null, achieved_at: "2027-04-01" }), 100);
});

test("goals number 1 to the last in the order the coach entered them", () => {
  const goals = [
    { position: 900, created_at: "2026-11-03T10:00:00Z", title: "c" },
    { position: 5, created_at: "2026-11-01T10:00:00Z", title: "a" },
    { position: 20000, created_at: "2026-11-02T10:00:00Z", title: "b" },
  ];
  assert.deepEqual(sortGoals(goals).map((g) => g.title), ["a", "b", "c"]);
});

test("the pledge: one I will... that covers every standard", () => {
  assert.deepEqual(cleanPledge("  I will sprint on and off and hold the standard  "), { [PLEDGE_KEY]: "I will sprint on and off and hold the standard" });
  assert.deepEqual(cleanPledge("   "), {});
  assert.equal(cleanPledge("x".repeat(PLEDGE_MAX + 50))[PLEDGE_KEY].length, PLEDGE_MAX);
  assert.deepEqual(pledgeStatus({ lines: cleanPledge("I will compete"), signed_at: null }), { written: true, signed: false, complete: false });
  assert.equal(pledgeStatus({ lines: cleanPledge("I will compete"), signed_at: "2026-11-11" }).complete, true);
  assert.equal(pledgeStatus({ lines: {}, signed_at: "2026-11-11" }).complete, false, "signing alone isn't enough");
  assert.equal(pledgeStatus(null).signed, false);
  // a pledge saved before (a line per standard) still reads as written
  assert.equal(pledgeLine({ Hustle: "I will sprint", Respect: "I will listen" }), "I will sprint I will listen");
});
