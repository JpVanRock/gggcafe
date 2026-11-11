// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_KEYS, CATCHER_MEASUREMENT, DEFAULT_MEASUREMENTS, PITCHER_MEASUREMENT, SEASONS, bestOf, formatMeasure, measurementsFor, seasonGrid,
  seasonLabel, seasonOf, softballYear, yearLabel, yearsWithData,
} from "../../src/lib/measurements.ts";
import { BEST_VERSION_KEYS, BEST_VERSION_PROMPTS, CHALLENGE, cleanBestVersion } from "../../src/lib/best-version.ts";

test("four seasons a year, set by the date, in a September-to-August softball year", () => {
  assert.deepEqual(SEASONS.map((s) => s.name), ["Fall Season", "Winter Offseason", "Spring Season", "Summer Season"]);
  assert.deepEqual(SEASONS.flatMap((s) => s.months).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(seasonOf("2026-09-01"), "fall");
  assert.equal(seasonOf("2026-12-15"), "winter");
  assert.equal(seasonOf("2027-02-28"), "winter");
  assert.equal(seasonOf("2027-04-10"), "spring");
  assert.equal(seasonOf("2027-08-31"), "summer");
  assert.equal(softballYear("2026-10-01"), 2026);
  assert.equal(softballYear("2027-03-01"), 2026);
  assert.equal(softballYear("2027-09-01"), 2027);
  assert.equal(yearLabel(2026), "2026–27");
  assert.equal(yearLabel(2099), "2099–00");
  assert.equal(seasonLabel("fall", 2026), "Fall Season 2026");
  assert.equal(seasonLabel("winter", 2026), "Winter Offseason 2026–27");
  assert.equal(seasonLabel("summer", 2026), "Summer Season 2027");
});

test("the default list, fastball speed for pitchers, pop time for catchers, then the team's extras", () => {
  const keys = (defs: { key: string }[]) => defs.map((d) => d.key);
  assert.deepEqual(keys(DEFAULT_MEASUREMENTS), [
    "home_to_first", "first_to_second", "first_to_home", "throw_velo_overhand", "rotational_acceleration", "connection_score", "on_plane_score",
  ]);
  assert.equal(DEFAULT_MEASUREMENTS[0].name, "Time to first");
  const all = [{ key: "exit_velo_tee", name: "Exit velocity (tee)", unit: "mph", better: "higher" as const }];
  assert.deepEqual(keys(measurementsFor(["SS", "2B"], [], [], all)), keys(DEFAULT_MEASUREMENTS));
  assert.deepEqual(keys(measurementsFor(["P"], [], [], all)).slice(-1), [PITCHER_MEASUREMENT.key]);
  assert.deepEqual(keys(measurementsFor(["3B", "C"], [], [], all)).slice(-1), [CATCHER_MEASUREMENT.key]);
  const withExtra = measurementsFor(["LF"], ["exit_velo_tee", "home_to_first"], ["exit_velo_tee", "nope"], all);
  assert.deepEqual(keys(withExtra).slice(-1), ["exit_velo_tee"], "extras once, unknown keys skipped, defaults not repeated");
  // a non-pitcher with a fastball measurement still sees it
  assert.ok(keys(measurementsFor(["CF"], [], ["pitch_velo_fastball"], all)).includes("pitch_velo_fastball"));
  assert.equal(new Set(BUILT_IN_KEYS).size, 9);
});

test("each season shows its latest value; the best is by direction", () => {
  const rows = [
    { id: "a", metric_key: "home_to_first", value: 3.4, measured_on: "2026-09-10" },
    { id: "b", metric_key: "home_to_first", value: 3.2, measured_on: "2026-11-02" },
    { id: "c", metric_key: "home_to_first", value: 3.1, measured_on: "2027-01-20" },
    { id: "d", metric_key: "home_to_first", value: 2.9, measured_on: "2025-10-01" },
  ];
  const grid = seasonGrid(rows, 2026);
  assert.equal(grid.get("home_to_first")?.fall?.id, "b", "latest in the season");
  assert.equal(grid.get("home_to_first")?.winter?.id, "c");
  assert.equal(grid.get("home_to_first")?.spring, undefined);
  assert.equal(bestOf(rows, DEFAULT_MEASUREMENTS[0])?.id, "d", "lower is better, any year");
  assert.equal(bestOf(rows, { key: "x", name: "x", unit: "mph", better: "higher" }), null);
  assert.deepEqual(yearsWithData(rows, 2026), [2026, 2025]);
  assert.equal(formatMeasure(3.1, "sec"), "3.1 sec");
  assert.equal(formatMeasure(54, "mph"), "54 mph");
  assert.equal(formatMeasure(62.456, "score"), "62.46");
});

test("The Best Version of You: four questions and the 15-minute challenge", () => {
  assert.equal(BEST_VERSION_PROMPTS.length, 4);
  assert.equal(BEST_VERSION_PROMPTS[3].question, "Would I want to be my teammate?");
  assert.match(CHALLENGE.question, /fifteen minutes on my off days/);
  assert.equal(new Set(BEST_VERSION_KEYS).size, BEST_VERSION_KEYS.length);
  assert.deepEqual(cleanBestVersion({ want: "  Start at short  ", cost: "", nope: "x", fifteen: "Tee work".padEnd(1200, "!") }), {
    want: "Start at short",
    fifteen: "Tee work".padEnd(1000, "!"),
  });
});
