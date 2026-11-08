// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { PACKET_STARTERS, cleanMedical, cleanQuestionnaire, medicalOnFile } from "../../src/lib/family.ts";

test("questionnaire: sizes, numbers, positions", () => {
  const q = cleanQuestionnaire({ top_size: "AM", bottom_size: "XL", numbers: ["7", "7", "00", "21", "3"], positions: ["SS", "P", "XX", "SS"], goals: "  Start at short  " });
  assert.ok(typeof q !== "string");
  if (typeof q === "string") return;
  assert.equal(q.top_size, "AM");
  assert.equal(q.bottom_size, null);
  assert.deepEqual(q.numbers, ["7", "00", "21"]);
  assert.deepEqual(q.positions, ["SS", "P"]);
  assert.equal(q.goals, "Start at short");
  assert.equal(typeof cleanQuestionnaire({ numbers: ["100"] }), "string");
});

test("medical card: needs one contact with a phone", () => {
  assert.equal(typeof cleanMedical({ allergies: "Peanuts" }), "string");
  const ok = cleanMedical({ contact1_name: "Pat Lopez", contact1_phone: "555-0100", allergies: "  " });
  assert.ok(typeof ok !== "string");
  if (typeof ok !== "string") assert.equal(ok.allergies, null);
  assert.equal(typeof cleanMedical({ contact1_name: "x", contact1_phone: "1", notes: "a".repeat(501) }), "string");
  assert.equal(medicalOnFile({ contact1_name: "Pat", contact1_phone: "1" }), true);
  assert.equal(medicalOnFile(null), false);
});

test("starter tips", () => {
  assert.ok(PACKET_STARTERS.length >= 5);
  for (const t of PACKET_STARTERS) assert.ok(t.title.length <= 100 && t.body.length <= 3000);
});
