// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageGroupOf } from "../../src/lib/softball.ts";

test("age group comes from the team's age group text", () => {
  assert.equal(ageGroupOf("16U"), "16U");
  assert.equal(ageGroupOf("16u"), "16U");
  assert.equal(ageGroupOf("GGG Gold 14 U"), "14U");
  assert.equal(ageGroupOf("08U"), "8U");
  assert.equal(ageGroupOf("9U"), null); // not one of the tabs
  assert.equal(ageGroupOf("Varsity"), null);
  assert.equal(ageGroupOf(null), null);
});
