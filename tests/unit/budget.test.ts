// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CREDIT_USED, CREDIT_WON, ENTRY_FORM_CATEGORIES, INCOME_CATEGORIES, centsToDollars, coachLedger, coachTotals, creditBalance, creditLedger, money,
  parseMoney, playerBalances, runningLedger, toCents,
} from "../../src/lib/budget.ts";

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

test("tournament credits: won adds, used takes off, across seasons; other lines don't count", () => {
  const entries = [
    { date: "2026-10-05", kind: "expense" as const, category: CREDIT_USED, cents: 20000 },
    { date: "2026-09-28", kind: "income" as const, category: CREDIT_WON, cents: 25000 },
    { date: "2026-09-29", kind: "income" as const, category: "Sponsor", cents: 99999 },
    { date: "2026-10-05", kind: "income" as const, category: CREDIT_WON, cents: 10000 },
    { date: "2027-03-01", kind: "expense" as const, category: "Tournament fees", cents: 50000 },
  ];
  const rows = creditLedger(entries);
  assert.deepEqual(rows.map((r) => r.balance), [25000, 35000, 15000], "same day: credit won before credit used");
  assert.equal(creditBalance(entries), 15000);
  assert.equal(creditBalance([]), 0);
});

test("the general expense/income form leaves out credits and coach repayments", () => {
  assert.ok(INCOME_CATEGORIES.includes("Reimbursement") && INCOME_CATEGORIES.includes("Fundraiser"));
  assert.ok(!ENTRY_FORM_CATEGORIES.income.includes(CREDIT_WON));
  assert.ok(!ENTRY_FORM_CATEGORIES.expense.includes(CREDIT_USED));
  assert.ok(!ENTRY_FORM_CATEGORIES.expense.includes("Coach reimbursement"));
  assert.ok(ENTRY_FORM_CATEGORIES.income.includes("Reimbursement"));
});

test("coaches' out-of-pocket: spending adds to what's owed, repayment takes it off", () => {
  const items = [
    { id: "a", date: "2026-09-02", paidBy: "Coach Dee", item: "Practice balls", cents: 8999, repaidOn: "2026-09-20" },
    { id: "b", date: "2026-09-04", paidBy: "Coach Dee", item: "Pizza", cents: 6000, repaidOn: null },
    { id: "c", date: "2026-09-06", paidBy: "Pat Parent", item: "Ice", cents: 1500, repaidOn: null },
  ];
  const rows = coachLedger(items);
  assert.deepEqual(rows.map((r) => `${r.type}:${r.owed}`), ["spent:8999", "spent:14999", "spent:16499", "repaid:7500"]);
  const t = coachTotals(items);
  assert.deepEqual([t.spent, t.repaid, t.owed], [16499, 8999, 7500]);
  assert.deepEqual(t.owedTo, [{ name: "Coach Dee", cents: 6000 }, { name: "Pat Parent", cents: 1500 }]);
});
