// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AGE_TIERS, PHASE_KINDS, RATING_LABELS, TESTS, composite, cutoffsFor, onTheClock, overlaps, phaseOn, phaseWeek, rate, squadStandings,
  suggestRoadmap, tierFor, validCutoffs,
} from "../../src/lib/training-plan.ts";

test("the roadmap is planned backward from the first game and the championship", () => {
  const plan = suggestRoadmap({ start: "2026-11-02", firstGame: "2027-03-27", championship: "2027-07-18" });
  assert.deepEqual(plan.map((p) => p.kind), ["testing", "build", "sport", "testing", "preseason", "inseason"]);
  // back to back, no gaps or overlaps
  for (let i = 1; i < plan.length; i++) {
    const prevEnd = new Date(`${plan[i - 1].ends_on}T00:00:00Z`);
    prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
    assert.equal(plan[i].starts_on, prevEnd.toISOString().slice(0, 10), `${plan[i].name} follows ${plan[i - 1].name}`);
  }
  assert.equal(plan[0].starts_on, "2026-11-02");
  assert.equal(plan.at(-1)!.ends_on, "2027-07-18");
  const sport = plan.find((p) => p.kind === "sport")!;
  assert.equal(phaseWeek(sport, sport.ends_on).of, 6);
  const pre = plan.find((p) => p.kind === "preseason")!;
  assert.equal(pre.ends_on, "2027-03-26");
  assert.ok(phaseWeek(pre, pre.starts_on).of >= 3);
  assert.equal(overlaps(plan).length, 0);
});

test("a short runway: a testing week, then sport-specific; bad dates give nothing", () => {
  const plan = suggestRoadmap({ start: "2027-02-01", firstGame: "2027-03-27", championship: "2027-06-01" });
  assert.deepEqual(plan.map((p) => p.kind), ["testing", "sport", "preseason", "inseason"]);
  assert.deepEqual(suggestRoadmap({ start: "2027-03-10", firstGame: "2027-03-27", championship: "2027-06-01" }).map((p) => p.kind), ["preseason", "inseason"]);
  assert.deepEqual(suggestRoadmap({ start: "2027-04-01", firstGame: "2027-03-27", championship: "2027-06-01" }), []);
});

test("phase on a date and its week", () => {
  const phases = [
    { name: "Build", starts_on: "2026-11-09", ends_on: "2027-01-10" },
    { name: "Retest", starts_on: "2027-01-04", ends_on: "2027-01-10" },
  ];
  assert.equal(phaseOn(phases, "2026-11-20")?.name, "Build");
  assert.equal(phaseOn(phases, "2027-01-05")?.name, "Retest", "the later start wins");
  assert.equal(phaseOn(phases, "2027-02-01"), null);
  assert.deepEqual(phaseWeek(phases[0], "2026-11-23"), { week: 3, of: 9 });
  assert.deepEqual(overlaps(phases), [["Build", "Retest"]]);
  assert.equal(PHASE_KINDS.length, 6);
});

test("tests: ten, all in the database, bands run in the better direction for every tier", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261109010000_offseason_training.sql", import.meta.url), "utf8");
  assert.equal(TESTS.length, 10);
  for (const t of TESTS) {
    if (!["home_to_first", "vertical_jump"].includes(t.key)) assert.ok(sql.includes(`('${t.key}',`), `${t.key} metric`);
    for (const tier of AGE_TIERS) assert.ok(validCutoffs(t.better, t.bands[tier]), `${t.key} ${tier}`);
    // older players need a better result for the same rating (or the same)
    for (let i = 1; i < AGE_TIERS.length; i++) {
      const [a, b] = [t.bands[AGE_TIERS[i - 1]][3], t.bands[AGE_TIERS[i]][3]];
      assert.ok(t.better === "higher" ? b >= a : b <= a, `${t.key} elite gets harder with age`);
    }
  }
});

test("tiers, ratings and the composite", () => {
  assert.equal(tierFor("8U"), "youth");
  assert.equal(tierFor("11U"), "u12");
  assert.equal(tierFor("14U"), "u14");
  assert.equal(tierFor("16U"), "u16");
  assert.equal(tierFor("18U"), "u18");
  assert.equal(tierFor(null), "u14");
  const agility = TESTS.find((t) => t.key === "pro_agility")!;
  const cut = cutoffsFor(agility, "11U");
  assert.deepEqual(cut, [6.5, 6.1, 5.8, 5.5]);
  assert.equal(rate(6.8, "lower", cut), 1);
  assert.equal(rate(5.8, "lower", cut), 4, "reaching a cutoff counts");
  assert.equal(rate(5.2, "lower", cut), 5);
  assert.equal(rate(70, "higher", [54, 60, 66, 72]), 4);
  assert.deepEqual(cutoffsFor(agility, "11U", [{ metric_key: "pro_agility", age_group: "11U", cutoffs: [7, 6.5, 6, 5.5] }]), [7, 6.5, 6, 5.5]);
  assert.ok(!validCutoffs("lower", [5, 6, 7, 8]));
  assert.ok(!validCutoffs("higher", [5, 5, 7, 8]));
  assert.equal(RATING_LABELS.length, 5);
  assert.equal(composite([5, 5, 4, 3]), 85);
  assert.equal(composite([]), null);
});

test("snake draft order and squad standings", () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => onTheClock(3, i)), [0, 1, 2, 2, 1, 0, 0, 1, 2]);
  assert.deepEqual(Array.from({ length: 4 }, (_, i) => onTheClock(2, i)), [0, 1, 1, 0]);
  const standings = squadStandings(
    [
      { id: "a", name: "Heat", captain_id: "p1", pick_order: 1, members: ["p1", "p3"] },
      { id: "b", name: "Storm", captain_id: "p2", pick_order: 2, members: ["p2", "p4", "gone"] },
    ],
    [
      { player_id: "p1", points: 10, week_points: 3 },
      { player_id: "p2", points: 20, week_points: 5 },
      { player_id: "p3", points: 15, week_points: 0 },
      { player_id: "p4", points: 5, week_points: 5 },
    ],
  );
  assert.deepEqual(standings.map((s) => [s.name, s.points, s.weekPoints]), [["Storm", 25, 10], ["Heat", 25, 3]]);
});
