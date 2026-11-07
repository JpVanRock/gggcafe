// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clockLabel, clockRange, durationLabel, equipmentChecklist, finalizeProblems, parseClock, planTimeline, practiceRange,
} from "../../src/lib/dugout.ts";

test("durations read like a coach says them", () => {
  assert.equal(durationLabel(45), "45 min");
  assert.equal(durationLabel(60), "1 hr");
  assert.equal(durationLabel(105), "1 hr 45 min");
});

test("clock times parse and print in 12-hour time", () => {
  assert.equal(parseClock("17:30:00"), 1050);
  assert.equal(parseClock(""), null);
  assert.equal(parseClock("25:00"), null);
  assert.equal(clockLabel(1050), "5:30 PM");
  assert.equal(clockLabel(0), "12:00 AM");
  assert.equal(clockLabel(720), "12:00 PM");
  assert.equal(clockLabel(1440 + 15), "12:15 AM");
  assert.equal(clockRange(1050, 1065), "5:30–5:45 PM");
});

test("timeline runs block to block from the start time", () => {
  const { slots, used } = planTimeline("17:30", [{ minutes: 15 }, { minutes: null }, { minutes: 20 }]);
  assert.equal(used, 35);
  assert.deepEqual(slots.map((s) => s.label), ["5:30–5:45 PM", null, "5:45–6:05 PM"]);
  assert.deepEqual(slots.map((s) => [s.start, s.end]), [[0, 15], [15, 15], [15, 35]]);
});

test("timeline without a start time shows elapsed time", () => {
  const { slots } = planTimeline(null, [{ minutes: 50 }, { minutes: 25 }]);
  assert.deepEqual(slots.map((s) => s.label), ["0:00–0:50", "0:50–1:15"]);
  assert.equal(practiceRange(null, 90), null);
  assert.equal(practiceRange("16:00:00", 120), "4:00–6:00 PM");
  assert.equal(practiceRange("11:30", 60), "11:30 AM–12:30 PM");
});

test("equipment checklist merges every drill's list without repeats", () => {
  assert.deepEqual(
    equipmentChecklist([{ equipment: "Cones, buckets" }, { equipment: null }, { equipment: "buckets;  Pop-up  machine\nCONES" }]),
    ["Cones", "buckets", "Pop-up machine"],
  );
});

test("a plan needs drills with time limits to finalize", () => {
  assert.deepEqual(finalizeProblems([]), ["Add at least one drill."]);
  assert.deepEqual(finalizeProblems([{ name: "Relays", minutes: null }]), ["Set a time limit for “Relays”."]);
  assert.deepEqual(finalizeProblems([{ name: "A", minutes: null }, { name: "B", minutes: 0 }]), ["Set a time limit for 2 drills."]);
  assert.deepEqual(finalizeProblems([{ name: "A", minutes: 10 }]), []);
});
