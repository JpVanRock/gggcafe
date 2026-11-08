// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanScript, commandByPitch, fullCountFinish, sessionPct, zoneLabel } from "../../src/lib/bullpen.ts";

test("scripts are cleaned: types, zones, intents, counts", () => {
  assert.deepEqual(cleanScript([{ pitch: "Rise", zone: 2, intent: "up", count: "0-2" }, { pitch: "Drop", zone: "8", intent: "strike", count: "x" }]), [
    { pitch: "Rise", zone: 2, intent: "up", count: "0-2" },
    { pitch: "Drop", zone: 8, intent: "strike", count: null },
  ]);
  assert.equal(typeof cleanScript([]), "string");
  assert.equal(typeof cleanScript([{ pitch: "Slider", zone: 5, intent: "strike" }]), "string", "no overhand pitches");
  assert.equal(typeof cleanScript([{ pitch: "Rise", zone: 10, intent: "up" }]), "string");
  assert.equal(typeof cleanScript(Array.from({ length: 81 }, () => ({ pitch: "Drop", zone: 8, intent: "strike" }))), "string");
});

test("command by pitch type and per session", () => {
  const sessions = [
    { results: [{ pitch: "Drop", zone: 8, intent: "strike", hit: true }, { pitch: "Drop", zone: 7, intent: "strike", hit: false }, { pitch: "Rise", zone: 2, intent: "up", hit: true }] },
    { results: [{ pitch: "Drop", zone: 9, intent: "strike", hit: true }] },
  ] as Parameters<typeof commandByPitch>[0];
  assert.deepEqual(commandByPitch(sessions).map((c) => [c.pitch, c.thrown, c.pct]), [["Drop", 3, 67], ["Rise", 1, 100]]);
  assert.equal(sessionPct(sessions[0].results), 67);
  assert.equal(sessionPct([]), 0);
});

test("zone labels and the full-count finish", () => {
  assert.equal(zoneLabel(5), "Middle, center");
  assert.equal(zoneLabel(13), "Off the plate, down-left");
  assert.deepEqual(fullCountFinish(["Drop", "Change-up"]).map((p) => p.count), ["3-2", "3-2"]);
});
