// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { HITTING, MOVEMENT, changes, cleanValues, dialOne, moveDial } from "../../src/lib/movement.ts";

test("#1 spot comes from how she moves and her balance leg", () => {
  assert.equal(dialOne({ move_style: "aerial", power_side: "left" }), "left_front");
  assert.equal(dialOne({ move_style: "terrestrial", power_side: "right" }), "right_heel");
  assert.equal(dialOne({ dial_one: "left_heel", move_style: "aerial", power_side: "right" }), "left_heel");
  assert.equal(dialOne({ move_style: "aerial" }), null);
});

test("move dial matches the four standard dials", () => {
  // bouncy (toes): 4 is the heel behind 1
  assert.deepEqual(moveDial({ dial_one: "left_front" }), { left_front: "1", left_heel: "4", right_front: "2/3", right_heel: "2/3" });
  assert.deepEqual(moveDial({ dial_one: "right_front" }), { right_front: "1", right_heel: "4", left_front: "2/3", left_heel: "2/3" });
  // grounded (heel): 4 is the toes on the other foot
  assert.deepEqual(moveDial({ dial_one: "left_heel" }), { left_heel: "1", right_front: "4", left_front: "2/3", right_heel: "2/3" });
  assert.deepEqual(moveDial({ dial_one: "right_heel" }), { right_heel: "1", left_front: "4", left_heel: "2/3", right_front: "2/3" });
  assert.equal(moveDial({}), null);
});

test("#2 sits on the heel side for close + breathe in, toes side for close + breathe out", () => {
  const closeIn = moveDial({ dial_one: "right_front", space: "axial", breathing: "in" })!;
  assert.equal(closeIn.left_heel, "2");
  assert.equal(closeIn.left_front, "3");
  const closeOut = moveDial({ dial_one: "right_front", space: "axial", breathing: "out" })!;
  assert.equal(closeOut.left_front, "2");
  const wideIn = moveDial({ dial_one: "right_heel", space: "large", breathing: "in" })!;
  assert.equal(wideIn.right_front, "2");
  assert.equal(wideIn.left_heel, "3");
});

test("only known choices are kept, and changes read in plain words", () => {
  assert.deepEqual(cleanValues(HITTING.slice(0, 2), { hands_height: "high", hands_depth: "sideways" }), { hands_height: "high", hands_depth: null });
  assert.deepEqual(changes(HITTING, { hands_height: "high", load_stride: "toe_tap" }, { hands_height: "low", load_stride: "toe_tap" }), [
    "Hand height: Hands high → Hands low",
  ]);
  assert.deepEqual(changes(MOVEMENT, null, { move_style: "aerial" }), ["How you move: Bouncy & light"]);
});
