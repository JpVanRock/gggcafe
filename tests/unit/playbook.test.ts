// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAY_CATEGORIES, PLAY_CATEGORY_LABEL, SCOUT_PROMPTS, parseChoices, quizScore, shuffled, suggestDefense,
} from "../../src/lib/playbook.ts";

test("depth chart: scarce positions first, best available, leftovers sit", () => {
  const depth = {
    P: ["ava", "bea"],
    C: ["cam"],
    SS: ["ava", "dee"],
    "1B": ["bea", "eve"],
    CF: ["fay"],
  };
  const out = suggestDefense(depth, ["ava", "bea", "cam", "dee", "eve", "fay", "gia"]);
  assert.deepEqual(out, { cam: "C", fay: "CF", ava: "P", dee: "SS", bea: "1B", eve: "Sub", gia: "Sub" });
});

test("depth chart skips players who aren't in the game", () => {
  const out = suggestDefense({ P: ["ava", "bea"], SS: ["bea"] }, ["bea", "cam"]);
  // SS has one option (bea) and P has one (bea): P comes first in field order, so SS stays open
  assert.deepEqual(out, { bea: "P", cam: "Sub" });
});

test("every play category has a label", () => {
  for (const c of PLAY_CATEGORIES) assert.ok(PLAY_CATEGORY_LABEL[c]);
});

test("choices: one per line, 2-5, no duplicates", () => {
  assert.deepEqual(parseChoices(" Charge \n\n Hold \n"), ["Charge", "Hold"]);
  assert.deepEqual(parseChoices("Only one"), { error: "Write 2 to 5 answer choices, one per line." });
  assert.deepEqual(parseChoices("a\nb\nc\nd\ne\nf"), { error: "Write 2 to 5 answer choices, one per line." });
  assert.deepEqual(parseChoices("Same\nsame"), { error: "Two choices are the same." });
});

test("quiz score uses first tries", () => {
  const s = quizScore([
    { first_correct: true, is_correct: true },
    { first_correct: false, is_correct: true },
    { first_correct: false, is_correct: false },
    { first_correct: null, is_correct: null },
  ]);
  assert.deepEqual(s, { total: 4, answered: 3, firstTry: 1, pct: 25, toFix: 1, done: false });
  assert.equal(quizScore([]).done, false);
});

test("shuffle is a stable permutation", () => {
  const a = shuffled([1, 2, 3, 4, 5, 6], 42);
  assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(shuffled([1, 2, 3, 4, 5, 6], 42), a);
});

test("scouting prompts have unique keys and no sign-stealing prompt", () => {
  const keys = SCOUT_PROMPTS.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const p of SCOUT_PROMPTS) {
    assert.notEqual(p.category as string, "signs_and_signals");
    assert.ok(p.title.length <= 60 && p.prompt.length <= 200, p.key);
  }
});
