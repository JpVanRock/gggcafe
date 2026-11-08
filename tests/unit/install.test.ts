// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOTE_LIMITS, STARTER_ITEMS, cleanNote, groupInstallItems, installPace, installProgress, nextInstallStatus,
} from "../../src/lib/install.ts";

test("starter checklist covers every position and the key situations", () => {
  const positions = new Set(STARTER_ITEMS.filter((i) => i.category === "position").map((i) => i.group));
  assert.deepEqual([...positions].sort(), ["1B", "2B", "3B", "C", "OF", "P", "SS"]);
  const situations = new Set(STARTER_ITEMS.filter((i) => i.category === "situation").map((i) => i.group));
  for (const g of ["Bunt defense", "First and third", "Rundowns", "Slap defense", "Squeeze", "Cut-offs and relays", "Rules in play"]) {
    assert.ok(situations.has(g), g);
  }
  // titles fit the column and are unique within a group
  const keys = new Set<string>();
  for (const item of STARTER_ITEMS) {
    assert.ok(item.title.length <= 140 && item.group.length <= 40, item.title);
    const key = `${item.group}|${item.title}`;
    assert.ok(!keys.has(key), key);
    keys.add(key);
  }
});

test("status cycles through the four steps", () => {
  assert.equal(nextInstallStatus("not_started"), "taught");
  assert.equal(nextInstallStatus("taught"), "repped");
  assert.equal(nextInstallStatus("repped"), "game_ready");
  assert.equal(nextInstallStatus("game_ready"), "not_started");
});

test("progress and pace to opening day", () => {
  const progress = installProgress([{ status: "game_ready" }, { status: "taught" }, { status: "not_started" }, { status: "game_ready" }]);
  assert.deepEqual(progress, { not_started: 1, taught: 1, repped: 0, game_ready: 2, total: 4, readyPct: 50 });
  assert.equal(installProgress([]).readyPct, 0);

  const pace = installPace("2027-02-01", "2027-03-01", ["2027-01-30", "2027-02-02", "2027-02-02", "2027-02-09", "2027-03-01"], progress);
  assert.deepEqual(pace, { days: 28, practices: 2, toGo: 2, perPractice: 1 });
  assert.equal(installPace("2027-02-01", null, [], progress).days, null);
  assert.equal(installPace("2027-04-01", "2027-03-01", [], progress).perPractice, null);
  assert.equal(installPace("2027-02-01", "2027-03-01", [], progress).perPractice, null);
});

test("items group in first-seen order", () => {
  const groups = groupInstallItems([{ group: "P" }, { group: "C" }, { group: "P" }]);
  assert.deepEqual(groups.map((g) => [g.group, g.items.length]), [["P", 2], ["C", 1]]);
});

test("notes trim, blank to null, and respect limits", () => {
  assert.equal(cleanNote("  Win the first pitch  ", NOTE_LIMITS.objective, "Objective"), "Win the first pitch");
  assert.equal(cleanNote("   ", NOTE_LIMITS.cue, "Cue"), null);
  assert.deepEqual(cleanNote("x".repeat(121), NOTE_LIMITS.cue, "Cue"), { error: "Cue can be at most 120 characters." });
});
