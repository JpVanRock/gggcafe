// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { COACH_SIGNUP_ROLE, DUGOUT_TABS, ROLE_LABEL, canEditPlanRole, canEditRole, dugoutTabsFor, isCoachSignup, isHeadCoachRole } from "../../src/lib/roles.ts";

test("who edits, who is a head coach", () => {
  assert.deepEqual(["viewer", "assistant", "coach", "admin"].map((r) => canEditRole(r as never)), [false, true, true, true]);
  assert.deepEqual(["viewer", "assistant", "coach", "admin"].map((r) => isHeadCoachRole(r as never)), [false, false, true, true]);
  assert.equal(ROLE_LABEL.coach, "Head Coach");
  assert.equal(ROLE_LABEL.assistant, "Assistant Coach");
});

test("assistants lose four Dugout tabs; everyone else keeps all nine", () => {
  assert.equal(DUGOUT_TABS.length, 9);
  assert.equal(DUGOUT_TABS[0].label, "Roster");
  assert.deepEqual(dugoutTabsFor("assistant").map((t) => t.label), ["Roster", "Calendar", "Practice Plans", "Drill Library", "Team Budget"]);
  for (const role of ["coach", "admin", "viewer"] as const) assert.equal(dugoutTabsFor(role).length, 9, role);
});

test("practice plans: head coaches any, assistants their own", () => {
  assert.equal(canEditPlanRole("coach", "u1", "u2"), true);
  assert.equal(canEditPlanRole("admin", "u1", null), true);
  assert.equal(canEditPlanRole("assistant", "u1", "u1"), true);
  assert.equal(canEditPlanRole("assistant", "u1", "u2"), false);
  assert.equal(canEditPlanRole("assistant", "u1", null), false);
  assert.equal(canEditPlanRole("viewer", "u1", "u1"), false);
});

test("coach sign-ups map to staff roles", () => {
  assert.equal(COACH_SIGNUP_ROLE["head-coach"], "coach");
  assert.equal(COACH_SIGNUP_ROLE["assistant-coach"], "assistant");
  assert.equal(isCoachSignup("head-coach"), true);
  assert.equal(isCoachSignup("player"), false);
  assert.equal(isCoachSignup(undefined), false);
});
