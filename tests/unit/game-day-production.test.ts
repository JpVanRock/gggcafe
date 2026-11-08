// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { dpFlexProblems, fieldingPlayers, trackSubs } from "../../src/lib/gameday.ts";
import { STARTER_DUTIES, cleanLines, gameJobsFromDuties } from "../../src/lib/staff-duties.ts";

test("DP/FLEX checks", () => {
  assert.deepEqual(dpFlexProblems(["a", "b"], "a", "f"), []);
  assert.deepEqual(dpFlexProblems(["a", "b"], "x", null), ["The DP has to be in the batting order."]);
  assert.deepEqual(dpFlexProblems(["a", "b"], "a", "b"), ["The FLEX doesn't bat: take her out of the batting order."]);
  assert.deepEqual(dpFlexProblems(["a"], null, "f"), ["Pick the DP the FLEX plays defense for."]);
  assert.deepEqual(fieldingPlayers(["a", "b", "c"], "b", "f"), ["a", "c", "f"]);
  assert.deepEqual(fieldingPlayers(["a", "b"], null, null), ["a", "b"]);
});

test("substitutions and the re-entry rule", () => {
  const starters = ["a", "b", "c"];
  const r = trackSubs(starters, [
    { inning: 2, spot: 2, in: "s1" }, // sub for b
    { inning: 4, spot: 2, in: "b" }, // b re-enters in her spot: fine
    { inning: 5, spot: 2, in: "s1" }, // s1 left, can't come back
    { inning: 5, spot: 3, in: "s2" }, // sub for c
    { inning: 6, spot: 1, in: "c" }, // c re-enters in the wrong spot
    { inning: 6, spot: 2, in: "s3" }, // b leaves again
    { inning: 7, spot: 2, in: "b" }, // second re-entry: no
    { inning: 7, spot: 1, in: "s2" }, // s2 already in spot 3
  ]);
  assert.deepEqual(
    r.checks.map((c) => c.problem),
    [
      null,
      null,
      "A substitute who left can't come back.",
      null,
      "A starter re-enters only in her own spot.",
      null,
      "She already used her re-entry.",
      "She's already in the lineup (spot 3).",
    ],
  );
  assert.equal(r.checks[1].reentry, true);
  assert.deepEqual(r.current, { 1: "a", 2: "s3", 3: "s2" });
  assert.deepEqual(r.canReenter, ["c"]);
});

test("staff duties", () => {
  assert.ok(STARTER_DUTIES.some((d) => d.phase === "game"));
  assert.deepEqual(cleanLines(" one \n\n two ", 5, 10), ["one", "two"]);
  assert.deepEqual(cleanLines("a\nb\nc", 2, 10), { error: "Keep it to 2 lines." });
  assert.deepEqual(cleanLines("a much longer line", 2, 5), { error: "Keep each line to 5 characters." });
  assert.deepEqual(
    gameJobsFromDuties([
      { phase: "game", duty: "Keep the book", owner: "Coach Kim" },
      { phase: "game", duty: "Video", owner: null },
      { phase: "pregame", duty: "Warm-up", owner: "Coach Lee" },
    ]),
    [{ job: "Keep the book", who: "Coach Kim" }],
  );
});
