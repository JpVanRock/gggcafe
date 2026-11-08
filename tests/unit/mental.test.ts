// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GUIDED_SESSIONS, SCAN_LABELS, SCAN_SKILLS, SIGNALS, isValidScan, monthStart, patternSeconds, scanAverage, scanChange,
  scanExtremes, sessionBySlug, zoneStatus,
} from "../../src/lib/mental.ts";

test("signals: three lights, releases for yellow and red", () => {
  assert.deepEqual(SIGNALS.map((s) => s.light), ["green", "yellow", "red"]);
  assert.deepEqual(SIGNALS.filter((s) => s.release).map((s) => s.light), ["yellow", "red"]);
});

test("zone status against her zone or the default 6-8", () => {
  assert.equal(zoneStatus(3, null), "under");
  assert.equal(zoneStatus(7, null), "in");
  assert.equal(zoneStatus(9, null), "over");
  assert.equal(zoneStatus(5, { low: 4, high: 6 }), "in");
  assert.equal(zoneStatus(7, { low: 4, high: 6 }), "over");
  assert.equal(zoneStatus(5, { low: null, high: null }), "under");
});

test("self-scan: ten skills, five labels, validation and math", () => {
  assert.equal(SCAN_SKILLS.length, 10);
  assert.equal(new Set(SCAN_SKILLS.map((s) => s.key)).size, 10);
  assert.equal(SCAN_LABELS.length, 5);
  assert.ok(isValidScan([1, 2, 3, 4, 5, 5, 4, 3, 2, 1]));
  assert.ok(!isValidScan([1, 2, 3]));
  assert.ok(!isValidScan([0, 2, 3, 4, 5, 5, 4, 3, 2, 1]));
  assert.ok(!isValidScan([1.5, 2, 3, 4, 5, 5, 4, 3, 2, 1]));
  assert.equal(scanAverage([3, 3, 3, 3, 3, 4, 4, 4, 4, 4]), 3.5);
  const { strongest, workOn } = scanExtremes([5, 2, 3, 3, 3, 3, 3, 3, 3, 5]);
  assert.deepEqual(strongest.map((s) => s.key), ["confidence", "perspective"]);
  assert.deepEqual(workOn.map((s) => s.key), ["focus"]);
  assert.deepEqual(scanChange([3, 3, 3, 3, 3, 3, 3, 3, 3, 3], [4, 3, 2, 3, 3, 3, 3, 3, 3, 3]).slice(0, 3), [1, 0, -1]);
  assert.deepEqual(scanChange(null, [4]), [null]);
  assert.equal(monthStart("2026-11-17"), "2026-11-01");
});

test("the database stores ten scores", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261109000100_mental_game.sql", import.meta.url), "utf8");
  assert.ok(sql.includes(`cardinality(scores) = ${SCAN_SKILLS.length}`));
});

test("guided sessions: seeded as drills, breathing has a pattern, imagery has steps", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261109000100_mental_game.sql", import.meta.url), "utf8");
  assert.equal(new Set(GUIDED_SESSIONS.map((s) => s.slug)).size, GUIDED_SESSIONS.length);
  for (const s of GUIDED_SESSIONS) {
    assert.ok(sql.includes(`'${s.slug}')`), `${s.slug} is seeded as a drill`);
    assert.ok(sql.includes(`'Guided: ${s.title}'`), `${s.slug} drill name`);
    assert.ok(s.intro.length && s.close, s.slug);
    if (s.kind === "breathing") {
      assert.ok(s.pattern && !s.steps, s.slug);
      // the minutes on the card are about right
      assert.ok(Math.abs(patternSeconds(s.pattern!) / 60 - s.minutes) <= 1, `${s.slug} length`);
    } else {
      assert.ok(s.steps?.length && !s.pattern, s.slug);
      const total = s.steps!.reduce((t, x) => t + x.seconds, 0);
      assert.ok(Math.abs(total / 60 - s.minutes) <= 1.5, `${s.slug} length`);
    }
  }
  assert.equal(sessionBySlug("reset-breath")?.title, "Reset Breath");
  assert.equal(sessionBySlug("nope"), undefined);
});
