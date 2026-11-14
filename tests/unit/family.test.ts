// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { PACKET_STARTERS, byDay, cleanMedical, cleanQuestionnaire, comingUp, medicalOnFile, type ComingUpItem } from "../../src/lib/family.ts";

test("coming up on the family page: by day and time (no time last), games first at the same time, each once", () => {
  const item = (key: string, date: string, start: string | null, game = false): ComingUpItem => ({ key, teamId: "t", date, start, title: key, place: null, game });
  const items = [
    item("late", "2026-11-14", "18:00"),
    item("no-time", "2026-11-13", null),
    item("game", "2026-11-13", "09:00", true),
    item("practice", "2026-11-13", "09:00"),
    item("early", "2026-11-13", "07:30"),
    item("early", "2026-11-13", "07:30"),
  ];
  const sorted = comingUp(items, 10);
  assert.deepEqual(
    sorted.map((i) => i.key),
    ["early", "game", "practice", "no-time", "late"],
  );
  assert.equal(comingUp(items, 2).length, 2);
  assert.deepEqual(
    byDay(sorted).map((d) => [d.date, d.items.length]),
    [
      ["2026-11-13", 4],
      ["2026-11-14", 1],
    ],
  );
});

test("questionnaire: sizes, numbers, positions", () => {
  const q = cleanQuestionnaire({ top_size: "AM", bottom_size: "XL", sock_size: "YL", jacket_size: "AL", numbers: ["7", "7", "00", "21", "3"], positions: ["SS", "P", "XX", "SS"], goals: "  Start at short  " });
  assert.ok(typeof q !== "string");
  if (typeof q === "string") return;
  assert.equal(q.top_size, "AM");
  assert.equal(q.bottom_size, null);
  assert.equal(q.sock_size, "YL");
  assert.ok(!("jacket_size" in q), "no jacket size any more");
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
