// Run with: npm run test:unit
// Team Hitting Philosophy and the Throwing Program (user, 2026-11-12).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHILOSOPHY_SECTIONS_MAX, PHILOSOPHY_STARTER, PHILOSOPHY_STATEMENT_MAX, PROGRAM_INTRO_MAX, PROGRAM_STEPS_MAX, SECTION_BODY_MAX,
  SECTION_TITLE_MAX, STEP_CUE_MAX, STEP_DOSE_MAX, STEP_NAME_MAX, THROWING_STARTERS, THROW_GROUPS, cleanSections, cleanSteps,
  isThrowGroup, throwGroupFor,
} from "../../src/lib/team-programs.ts";

test("throwing groups: Outies, Innies and Catchers, and the database's keys", () => {
  assert.deepEqual(THROW_GROUPS.map((g) => g.key), ["outies", "innies", "catchers"]);
  assert.deepEqual(THROW_GROUPS.map((g) => g.label), ["Outies", "Innies", "Catchers"]);
  assert.ok(isThrowGroup("innies"));
  assert.ok(!isThrowGroup("pitchers"));
  assert.ok(!isThrowGroup(null));
});

test("her group comes from her first fielding position; pitchers have their own program", () => {
  assert.equal(throwGroupFor(["SS", "2B"]), "innies");
  assert.equal(throwGroupFor(["CF"]), "outies");
  assert.equal(throwGroupFor(["C", "1B"]), "catchers");
  assert.equal(throwGroupFor(["P", "1B"]), "innies");
  assert.equal(throwGroupFor(["P", "CF"]), "outies");
  assert.equal(throwGroupFor(["P"]), null);
  assert.equal(throwGroupFor(["DP", "FLEX", null]), null);
  assert.equal(throwGroupFor([]), null);
});

test("sections: trimmed, capped, empty rows dropped, a body without a title kept", () => {
  assert.deepEqual(cleanSections(["  Two strikes ", "", ""], [" Battle. ", "", "Just a body"]), [
    { title: "Two strikes", body: "Battle." },
    { title: "Untitled", body: "Just a body" },
  ]);
  const many = Array.from({ length: 20 }, (_, i) => `S${i}`);
  assert.equal(cleanSections(many, many).length, PHILOSOPHY_SECTIONS_MAX);
  assert.equal(cleanSections(["x".repeat(500)], ["y".repeat(5000)])[0].title.length, SECTION_TITLE_MAX);
  assert.equal(cleanSections(["x"], ["y".repeat(5000)])[0].body.length, SECTION_BODY_MAX);
});

test("steps: a name is required, empty dose and cue become null, capped", () => {
  assert.deepEqual(cleanSteps(["Wrist flicks", "", "Long toss"], ["10 · 10 ft", "x", " "], ["", "y", "Arc it"]), [
    { name: "Wrist flicks", dose: "10 · 10 ft", cue: null },
    { name: "Long toss", dose: null, cue: "Arc it" },
  ]);
  const many = Array.from({ length: 40 }, (_, i) => `T${i}`);
  assert.equal(cleanSteps(many, [], []).length, PROGRAM_STEPS_MAX);
});

test("the starters fit the form and the database's limits", () => {
  assert.ok(PHILOSOPHY_STARTER.statement.length <= PHILOSOPHY_STATEMENT_MAX);
  assert.ok(PHILOSOPHY_STARTER.sections.length <= PHILOSOPHY_SECTIONS_MAX);
  assert.deepEqual(cleanSections(PHILOSOPHY_STARTER.sections.map((s) => s.title), PHILOSOPHY_STARTER.sections.map((s) => s.body)), PHILOSOPHY_STARTER.sections);
  for (const g of THROW_GROUPS) {
    const starter = THROWING_STARTERS[g.key];
    assert.ok(starter.intro.length <= PROGRAM_INTRO_MAX, g.key);
    assert.ok(starter.steps.length >= 5 && starter.steps.length <= PROGRAM_STEPS_MAX, g.key);
    for (const s of starter.steps) {
      assert.ok(s.name.length <= STEP_NAME_MAX && (s.dose ?? "").length <= STEP_DOSE_MAX && (s.cue ?? "").length <= STEP_CUE_MAX, s.name);
    }
    // every program starts with a warm-up and asks players to stop if it hurts
    assert.match(starter.steps[0].name, /warm-up/i, g.key);
    assert.match(starter.intro, /stop if anything hurts/, g.key);
  }
});
