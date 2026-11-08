// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { cellName, cleanZones, countPlan, cycle, stateOf } from "../../src/lib/my-zone.ts";

test("cells cycle through the states and stay in one list", () => {
  let z = { hot: [], strong: [], weak: [] } as { hot: number[]; strong: number[]; weak: number[] };
  z = cycle(z, 5);
  assert.equal(stateOf(z, 5), "strong");
  z = cycle(z, 5);
  assert.equal(stateOf(z, 5), "hot");
  assert.deepEqual(z.strong, []);
  z = cycle(z, 5);
  assert.equal(stateOf(z, 5), "weak");
  z = cycle(z, 5);
  assert.equal(stateOf(z, 5), "none");
  assert.deepEqual(z, { hot: [], strong: [], weak: [] });
});

test("clean zones: valid cells, no repeats across lists", () => {
  assert.deepEqual(cleanZones({ hot: [5, 5, 10, "4"], strong: [5, 6], weak: [0, 9, 1.5] }), { hot: [4, 5], strong: [6], weak: [9] });
  assert.deepEqual(cleanZones({}), { hot: [], strong: [], weak: [] });
});

test("count plan widens with strikes", () => {
  const plan = countPlan({ hot: [5], strong: [4, 6, 8], weak: [1, 3] });
  assert.deepEqual(plan.map((p) => p.swing), [[5], [4, 5, 6, 8], [2, 4, 5, 6, 7, 8, 9]]);
  assert.deepEqual(plan[2].battle, [1, 3]);
  // without a hot zone, 0 strikes falls back to what she handles
  assert.deepEqual(countPlan({ hot: [], strong: [5, 8], weak: [] })[0].swing, [5, 8]);
  assert.deepEqual(countPlan(null)[2].swing, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("cell names", () => {
  assert.equal(cellName(1), "Up, left (catcher's view)");
  assert.equal(cellName(5), "Middle, center (catcher's view)");
  assert.equal(cellName(9), "Down, right (catcher's view)");
});
