// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { percent, pitcherOf, rate, rotationProblems } from "../../src/lib/gameday.ts";

test("a full rotation has every field spot exactly once", () => {
  const full = { a: "P", b: "C", c: "1B", d: "2B", e: "3B", f: "SS", g: "LF", h: "CF", i: "RF", j: "Sub", k: "Sub" } as const;
  assert.deepEqual(rotationProblems(full), { missing: [], doubled: [] });
  const gaps = { a: "P", b: "SS", c: "SS", d: "Sub" } as const;
  const problems = rotationProblems(gaps);
  assert.ok(problems.missing.includes("C") && problems.missing.includes("RF"));
  assert.deepEqual(problems.doubled, ["SS"]);
  assert.equal(rotationProblems(undefined).missing.length, 9);
});

test("the pitcher is whoever plays P", () => {
  assert.equal(pitcherOf({ a: "SS", b: "P" }), "b");
  assert.equal(pitcherOf({ a: "SS" }), null);
});

test("stats read like a lineup card", () => {
  assert.equal(rate(0.4123), ".412");
  assert.equal(rate("0.300"), ".300");
  assert.equal(rate(1), "1.000");
  assert.equal(rate(null), "–");
  assert.equal(percent(18.46), "18.5%");
  assert.equal(percent(undefined), "–");
});
