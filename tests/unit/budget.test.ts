// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { centsToDollars, money, parseMoney, playerBalances, runningLedger, toCents } from "../../src/lib/budget.ts";

test("typed amounts become cents", () => {
  assert.equal(parseMoney("$1,250.5"), 125050);
  assert.equal(parseMoney("40"), 4000);
  assert.equal(parseMoney(" 0.07 "), 7);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("12.345"), "invalid");
  assert.equal(parseMoney("abc"), "invalid");
  assert.equal(parseMoney("-50"), "invalid");
  assert.equal(parseMoney("-50", { allowNegative: true }), -5000);
});

test("cents round-trip to dollars without drift", () => {
  assert.equal(toCents("125.50"), 12550);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(centsToDollars(12550), "125.50");
  assert.equal(centsToDollars(-500), "-5.00");
  assert.equal(money(125050), "$1,250.50");
});

test("each player's balance includes her discount", () => {
  const rows = playerBalances(
    ["a", "b", "c", "d"],
    52550,
    new Map([["c", -10000]]),
    [{ player_id: "a", cents: 52550 }, { player_id: "b", cents: 20000 }, { player_id: "c", cents: 50000 }, { player_id: null, cents: 999 }],
  );
  assert.deepEqual(rows.map((r) => [r.id, r.due, r.paid, r.owed, r.status]), [
    ["a", 52550, 52550, 0, "paid"],
    ["b", 52550, 20000, 32550, "partial"],
    ["c", 42550, 50000, -7450, "over"],
    ["d", 52550, 0, 52550, "unpaid"],
  ]);
});

test("ledger runs in date order with a running balance", () => {
  const rows = runningLedger([
    { date: "2026-09-10", kind: "expense" as const, cents: 65000 },
    { date: "2026-09-01", kind: "payment" as const, cents: 72550 },
    { date: "2026-09-10", kind: "income" as const, cents: 30000 },
  ]);
  assert.deepEqual(rows.map((r) => [r.date, r.kind, r.balance]), [
    ["2026-09-01", "payment", 72550],
    ["2026-09-10", "income", 102550],
    ["2026-09-10", "expense", 37550],
  ]);
});
