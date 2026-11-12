// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCOUNT_TYPES, LEVELS, QUESTIONS, SECTIONS, SIGNUP_LABEL, SIGNUP_TYPES } from "../../src/lib/account-types.ts";
import { DUGOUT_TABS, dugoutTabsFor } from "../../src/lib/roles.ts";

test("five account types, in the user's order, each with a sign-up and a home", () => {
  assert.deepEqual([...SIGNUP_TYPES], ["head-coach", "assistant-coach", "player", "parent", "mentor"]);
  assert.deepEqual(ACCOUNT_TYPES.map((t) => t.key), [...SIGNUP_TYPES]);
  assert.deepEqual(ACCOUNT_TYPES.map((t) => t.label), SIGNUP_TYPES.map((k) => SIGNUP_LABEL[k]));
  for (const t of ACCOUNT_TYPES) assert.ok(t.signup && t.home, t.key);
});

test("every row is marked for all five types", () => {
  const names = SECTIONS.flatMap((s) => s.rows.map((r) => r.name));
  assert.equal(new Set(names).size, names.length, "unique row names");
  for (const r of SECTIONS.flatMap((s) => s.rows)) {
    assert.deepEqual(Object.keys(r.access).sort(), [...SIGNUP_TYPES].sort(), r.name);
    for (const level of Object.values(r.access)) assert.ok(LEVELS.includes(level), `${r.name}: ${level}`);
    // "part" always says which part; a row nobody gets says who does (admins)
    if (Object.values(r.access).includes("part")) assert.ok(r.condition, `${r.name}: condition for part`);
    if (Object.values(r.access).every((l) => l === "no")) assert.ok(r.condition, `${r.name}: who has it`);
  }
});

test("the Dugout rows match each role's tabs", () => {
  const dugout = SECTIONS.find((s) => s.title === "Coaches Dugout")!;
  assert.deepEqual(dugout.rows.map((r) => r.name), DUGOUT_TABS.map((t) => t.label));
  const assistantTabs = new Set(dugoutTabsFor("assistant").map((t) => t.label));
  for (const r of dugout.rows) {
    assert.notEqual(r.access["head-coach"], "no", `head coach has ${r.name}`);
    assert.equal(r.access["assistant-coach"] !== "no", assistantTabs.has(r.name), `assistant and ${r.name}`);
  }
  // the user's list: assistants don't get culture, GameDay, parents or mentors
  for (const name of ["Culture", "GameDay", "Parents", "Mentors"]) assert.ok(!assistantTabs.has(name), name);
  const plans = dugout.rows.find((r) => r.name === "Practice Plans")!;
  assert.equal(plans.access["assistant-coach"], "part");
  // the user (2026-11-08): assistants see the Team Budget but can't change it
  assert.equal(dugout.rows.find((r) => r.name === "Budget")!.access["assistant-coach"], "view");
});

test("only approved parents create player logins", () => {
  const row = SECTIONS.flatMap((s) => s.rows).find((r) => r.name === "Create a player's login")!;
  assert.deepEqual(Object.entries(row.access).filter(([, l]) => l !== "no").map(([k]) => k), ["parent"]);
});

test("every question has an answer", () => {
  for (const item of QUESTIONS) assert.ok(item.q.endsWith("?") && item.a.length > 0, item.q);
});
