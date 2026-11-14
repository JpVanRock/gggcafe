// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATE_HEADINGS, amountCents, budgetTemplate, dateIso, findHeadings, headingKey, importTotals, matchPlayer, readBudgetRows, splitDuplicates,
  validLine, type ImportCell, type ImportKind, type ImportLists, type ImportPlayer,
} from "../../src/lib/budget-import.ts";
import { ENTRY_FORM_CATEGORIES, PAYMENT_CATEGORIES, PAYMENT_METHODS } from "../../src/lib/budget.ts";
import { readXlsx, writeXlsx } from "../../src/lib/spreadsheet.ts";

const LISTS: ImportLists = {
  payment: PAYMENT_CATEGORIES,
  expense: ENTRY_FORM_CATEGORIES.expense,
  income: ENTRY_FORM_CATEGORIES.income,
  methods: PAYMENT_METHODS,
};

const ROSTER: ImportPlayer[] = [
  { id: "p-avery", first_name: "Avery", last_name: "Smith", preferred_name: null, jersey_number: "12" },
  { id: "p-kate", first_name: "Katherine", last_name: "Lopez", preferred_name: "Kate", jersey_number: "7" },
  { id: "p-jo1", first_name: "Jordan", last_name: "Reyes", preferred_name: null, jersey_number: "3" },
  { id: "p-jo2", first_name: "Jordan", last_name: "Park", preferred_name: null, jersey_number: "03" },
  { id: "p-zoe", first_name: "Zoë", last_name: "Núñez", preferred_name: null, jersey_number: null },
];

function read(rows: ImportCell[][]) {
  const headings = findHeadings(rows);
  assert.ok(headings, "headings found");
  return readBudgetRows(rows, headings, ROSTER, LISTS);
}

test("headings: words, punctuation and a title row above them", () => {
  assert.equal(headingKey("Amount ($)"), "amount");
  assert.equal(headingKey("In/Out"), "in out");
  assert.equal(headingKey("Amount USD"), "amount usd");
  const found = findHeadings([["Team Budget 2026"], [], ["DATE", "Type", "Category", "Amount ($)", "Player", "Paid with", "Notes", "Balance"]]);
  assert.deepEqual(found, { row: 2, columns: { date: 0, type: 1, category: 2, amount: 3, player: 4, method: 5, description: 6 } });
  assert.equal(findHeadings([["Name", "Amount"], ["Avery", 10]]), null, "no date column");
  assert.deepEqual(findHeadings([["Date", "Description", "Money In", "Money Out"]])?.columns, { date: 0, description: 1, in: 2, out: 3 });
});

test("amounts", () => {
  assert.equal(amountCents(125.5), 12550);
  assert.equal(amountCents(0.1 + 0.2), 30);
  assert.equal(amountCents("$1,250.50"), 125050);
  assert.equal(amountCents("1250"), 125000);
  assert.equal(amountCents("(40.00)"), -4000);
  assert.equal(amountCents("-$15"), -1500);
  assert.equal(amountCents("15-"), -1500);
  assert.equal(amountCents("−15"), -1500);
  assert.equal(amountCents("12.345"), 1235);
  assert.equal(amountCents(".5"), 50);
  assert.equal(amountCents("40 USD"), 4000);
  assert.equal(amountCents(""), null);
  assert.equal(amountCents(null), null);
  assert.equal(amountCents("forty"), "invalid");
  assert.equal(amountCents("#REF!"), "invalid");
  assert.equal(amountCents("1.2.3"), "invalid");
});

test("dates", () => {
  assert.equal(dateIso("2026-11-13"), "2026-11-13");
  assert.equal(dateIso("2026-11-13T09:30:00"), "2026-11-13");
  assert.equal(dateIso("11/13/2026"), "2026-11-13");
  assert.equal(dateIso("11/13/26"), "2026-11-13");
  assert.equal(dateIso("1-5-2026"), "2026-01-05");
  assert.equal(dateIso("Nov 13, 2026"), "2026-11-13");
  assert.equal(dateIso("November 13th 2026"), "2026-11-13");
  assert.equal(dateIso("Friday, November 13, 2026"), "2026-11-13");
  assert.equal(dateIso("13 Nov 2026"), "2026-11-13");
  assert.equal(dateIso(46339), "2026-11-13", "an Excel serial that wasn't formatted as a date");
  assert.equal(dateIso(""), null);
  assert.equal(dateIso("13/11/2026"), "invalid", "month first");
  assert.equal(dateIso("2/30/2026"), "invalid");
  assert.equal(dateIso("1/1/1890"), "invalid");
  assert.equal(dateIso("soon"), "invalid");
  assert.equal(dateIso(12), "invalid");
});

test("players: full name, last-first, preferred name, first or last alone, jersey, accents, extra words", () => {
  const id = (s: string) => {
    const m = matchPlayer(s, ROSTER);
    return "player" in m ? m.player.id : m.error;
  };
  assert.equal(id("Avery Smith"), "p-avery");
  assert.equal(id("smith, avery"), "p-avery");
  assert.equal(id("  AVERY   SMITH "), "p-avery");
  assert.equal(id("Kate Lopez"), "p-kate");
  assert.equal(id("Katherine Lopez"), "p-kate");
  assert.equal(id("Kate"), "p-kate");
  assert.equal(id("Lopez"), "p-kate");
  assert.equal(id("#12"), "p-avery");
  assert.equal(id("12"), "p-avery");
  assert.equal(id("#7 Kate Lopez"), "p-kate");
  assert.equal(id("Zoe Nunez"), "p-zoe");
  assert.equal(id("Avery Smith (mom)"), "p-avery");
  assert.equal(id("Jordan Park"), "p-jo2");
  assert.match(id("Jordan"), /more than one player/);
  assert.match(id("#3"), /More than one player wears #3/);
  assert.match(id("#99"), /No player wears #99/);
  assert.match(id("Taylor Swift"), /No player named “Taylor Swift”/);
});

test("the template's columns: payments, expenses and income with categories and methods", () => {
  const { lines, problems, skipped } = read([
    ["Date", "Type", "Category", "Amount", "Player", "Method", "Description"],
    ["2026-11-01", "Payment", "Registration", 250, "Avery Smith", "Venmo", "First half"],
    ["2026-11-02", "Payment", "", "$100", "Kate", "credit card", null],
    ["2026-11-03", "Expense", "Tournament fees", 650, null, null, "Fall Classic"],
    ["2026-11-04", "Income", "Sponsor", 500, null, null, "Pizza place banner"],
    ["2026-11-05", "Expense", "Uniforms", -320.4, null, null, null],
    [],
    [null, null, "Total", 1080.6],
  ]);
  assert.deepEqual(problems, []);
  assert.equal(skipped, 1);
  assert.deepEqual(
    lines.map((l) => [l.row, l.kind, l.date, l.cents, l.category, l.playerId, l.method, l.description, l.note]),
    [
      [2, "payment", "2026-11-01", 25000, "Registration", "p-avery", "Venmo", "First half", null],
      [3, "payment", "2026-11-02", 10000, "Registration", "p-kate", "Card", null, null],
      [4, "expense", "2026-11-03", 65000, "Tournament fees", null, null, "Fall Classic", null],
      [5, "income", "2026-11-04", 50000, "Sponsor", null, null, "Pizza place banner", null],
      [6, "expense", "2026-11-05", 32040, "Uniforms", null, null, null, null],
    ],
  );
  assert.equal(lines[0].playerName, "Avery Smith");
});

test("no Type column: worked out from the player, money in/out columns, the category or a negative amount", () => {
  const { lines, problems } = read([
    ["Date", "Description", "Category", "Player", "Money In", "Money Out"],
    ["11/1/2026", "Dues", null, "Avery Smith", "250.00", null],
    ["11/2/2026", "Bats", "Equipment", null, null, "199.99"],
    ["11/3/2026", "Car wash", null, null, "310", null],
    ["11/4/2026", "Both", null, null, "10", "10"],
    ["11/5/2026", "Nothing", null, null, null, null],
  ]);
  assert.deepEqual(
    lines.map((l) => [l.row, l.kind, l.cents, l.category]),
    [
      [2, "payment", 25000, "Registration"],
      [3, "expense", 19999, "Equipment"],
      [4, "income", 31000, "Fundraiser"],
    ],
  );
  assert.deepEqual(problems, [
    { row: 5, message: "It has both money in and money out. Put them on separate rows." },
    { row: 6, message: "Say whether it's a Payment, Expense or Income (the Type column)." },
  ]);
  const signed = read([
    ["Date", "Category", "Amount", "Notes"],
    ["2026-11-01", "Umpires", 90, null],
    ["2026-11-02", "Fundraiser", 400, null],
    ["2026-11-03", null, -55, "Gas"],
  ]);
  assert.deepEqual(
    signed.lines.map((l) => [l.kind, l.category, l.cents]),
    [
      ["expense", "Umpires", 9000],
      ["income", "Fundraiser", 40000],
      ["expense", "Travel & lodging", 5500],
    ],
  );
});

test("everyday category words, a category named in Type, and unknown categories saved as Other", () => {
  const { lines, problems } = read([
    ["Date", "Type", "Category", "Amount", "Player", "Description"],
    ["2026-11-01", "Expense", "Hotel", 450, null, null],
    ["2026-11-02", "Expense", "ump fees", 120, null, null],
    ["2026-11-03", "Income", "Raffle", 75, null, null],
    ["2026-11-04", "Fundraiser", null, 300, null, "Bake sale"],
    ["2026-11-05", "Uniforms", null, 210, null, null],
    ["2026-11-06", "Expense", "Snacks & Gatorade", 35, null, null],
    ["2026-11-07", "Expense", "Mystery", 20, null, "Kept"],
    ["2026-11-08", "Payment", "Uniform", 60, "Avery Smith", null],
    ["2026-11-09", "Registration", null, 60, "Avery Smith", null],
    ["2026-11-10", "Payment", "Gift card", 25, "Avery Smith", null],
  ]);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    lines.map((l) => [l.kind, l.category, l.description, l.note]),
    [
      ["expense", "Travel & lodging", null, null],
      ["expense", "Umpires", null, null],
      ["income", "Fundraiser", null, null],
      ["income", "Fundraiser", "Bake sale", null],
      ["expense", "Uniforms", null, null],
      ["expense", "Team events", null, null],
      ["expense", "Other", "Kept", "“Mystery” isn't an expense category: saved as Other."],
      ["payment", "Equipment", null, null],
      ["payment", "Registration", null, null],
      ["payment", "Other", "Gift card", "“Gift card” isn't a payment category: saved as Other."],
    ],
  );
});

test("problems are reported by row, and the rest still import", () => {
  const { lines, problems } = read([
    ["Date", "Type", "Category", "Amount", "Player"],
    ["2026-11-01", "Payment", null, 100, null],
    ["2026-11-02", "Payment", null, 100, "Taylor"],
    ["2026-11-03", "Expense", null, "lots", null],
    ["2026-11-04", "Expense", null, null, null],
    ["2026-11-05", "Expense", null, 0, null],
    ["2026-11-06", "Payment", null, -20, "Avery Smith"],
    ["2026-11-07", "Expense", null, 2_000_000, null],
    ["13/11/2026", "Expense", null, 10, null],
    [null, "Expense", null, 10, null],
    ["2026-11-10", "Refund?", null, 10, null],
    ["2026-11-11", "Income", "Tournament credit", 250, null],
    ["2026-11-12", "Expense", "Field & facility", 80, null],
  ]);
  assert.deepEqual(problems, [
    { row: 2, message: "Player payments need the player's name." },
    { row: 3, message: "No player named “Taylor” on this season's roster." },
    { row: 4, message: "“lots” isn't an amount. Use a number like 125.50." },
    { row: 5, message: "There's no amount." },
    { row: 6, message: "The amount is 0." },
    { row: 7, message: "The amount is negative. Use a positive amount (refunds can be entered as an expense)." },
    { row: 8, message: "That's more than $1,000,000." },
    { row: 9, message: "“13/11/2026” isn't a date. Use a date like 11/13/2026." },
    { row: 10, message: "There's no date." },
    { row: 11, message: "Type “Refund?” isn't one we know. Use Payment, Expense or Income." },
    { row: 12, message: "Tournament credit has its own form: Tournament credit won or used." },
  ]);
  assert.deepEqual(
    lines.map((l) => [l.row, l.category]),
    [[13, "Field & facility"]],
  );
});

test("long descriptions are shortened to the ledger's 300 characters", () => {
  const { lines } = read([
    ["Date", "Type", "Amount", "Description"],
    ["2026-11-01", "Expense", 10, "x".repeat(400)],
  ]);
  assert.equal(lines[0].description!.length, 300);
  assert.match(lines[0].note!, /shortened/);
});

test("lines already in the budget are found, counting repeats", () => {
  const { lines } = read([
    ["Date", "Type", "Category", "Amount", "Player", "Description"],
    ["2026-11-01", "Payment", null, 50, "Avery Smith", null],
    ["2026-11-01", "Payment", null, 50, "Avery Smith", null],
    ["2026-11-02", "Expense", "Umpires", 90, null, "Game 1 "],
    ["2026-11-03", "Income", "Sponsor", 500, null, null],
  ]);
  const { fresh, duplicates } = splitDuplicates(lines, [
    // an older payment with no category counts as Registration
    { kind: "payment", entry_date: "2026-11-01", amount: 50, player_id: "p-avery", category: null, description: null },
    { kind: "expense", entry_date: "2026-11-02", amount: "90.00", player_id: null, category: "Umpires", description: "game 1" },
    { kind: "income", entry_date: "2026-11-03", amount: 500, player_id: null, category: "Fundraiser", description: null },
  ]);
  assert.deepEqual(
    duplicates.map((l) => l.row),
    [2, 4],
  );
  assert.deepEqual(
    fresh.map((l) => l.row),
    [3, 5],
  );
});

test("lines coming back from the browser are checked again", () => {
  const ids = new Set(["p-avery"]);
  const good = {
    row: 2, kind: "payment", date: "2026-11-01", cents: 2500, category: "Registration", playerId: "p-avery", playerName: "Avery Smith",
    method: "Venmo", description: "Half", note: "ignored",
  };
  assert.deepEqual(validLine(good, LISTS, ids), { ...good, note: null });
  const expense = { row: 3, kind: "expense", date: "2026-11-01", cents: 100, category: "Umpires", playerId: null, playerName: null, method: null, description: null };
  assert.ok(validLine(expense, LISTS, ids));
  const bad: Record<string, unknown>[] = [
    { ...good, kind: "credit" },
    { ...good, date: "2026-02-30" },
    { ...good, date: "11/01/2026" },
    { ...good, cents: 0 },
    { ...good, cents: 10.5 },
    { ...good, cents: 100_000_001 },
    { ...good, cents: "2500" },
    { ...good, category: "Uniforms" },
    { ...good, playerId: "someone-else" },
    { ...good, playerId: null },
    { ...good, method: "Bitcoin" },
    { ...good, description: "x".repeat(301) },
    { ...expense, playerId: "p-avery" },
    { ...expense, method: "Cash" },
    { ...expense, category: "Out-of-pocket reimbursement" },
    { ...expense, category: "Tournament credit used" },
  ];
  for (const b of bad) assert.equal(validLine(b, LISTS, ids), null, JSON.stringify(b));
  assert.equal(validLine(null, LISTS, ids), null);
  assert.equal(validLine("payment", LISTS, ids), null);
});

test("the template: headings, dropdown lists and a How to sheet; filled in like Excel saves it, every category imports as itself", () => {
  const sheets = budgetTemplate(["Avery Smith", "Kate Lopez"], LISTS, "Sample Team · Fall 2026 · Team Budget import");
  const back = readXlsx(writeXlsx(sheets));
  assert.deepEqual(
    back.map((s) => s.name),
    ["Budget", "How to"],
    "the Lists sheet is hidden",
  );
  assert.deepEqual(back[0].rows, [[...TEMPLATE_HEADINGS]]);
  assert.deepEqual(findHeadings(back[0].rows)?.columns, { date: 0, type: 1, category: 2, amount: 3, player: 4, method: 5, description: 6 });
  const lists = sheets[2].rows.slice(1);
  assert.deepEqual(lists.map((r) => r[0]).filter(Boolean), ["Payment", "Expense", "Income"]);
  assert.deepEqual(lists.map((r) => r[2]).filter(Boolean), ["Avery Smith", "Kate Lopez"]);
  assert.deepEqual(lists.map((r) => r[3]).filter(Boolean), [...PAYMENT_METHODS]);
  assert.deepEqual(sheets[0].lists?.map((l) => [l.cells, l.source]), [
    ["B2:B501", "Lists!$A$2:$A$4"],
    ["C2:C501", `Lists!$B$2:$B$${lists.filter((r) => r[1]).length + 1}`],
    ["E2:E501", "Lists!$C$2:$C$3"],
    ["F2:F501", "Lists!$D$2:$D$8"],
  ]);

  // a row for every category the dropdown offers, dated the way Excel stores dates (serial numbers in a date column)
  const offered = new Set(lists.map((r) => r[1]).filter(Boolean));
  const rows: (string | number | null)[][] = [[...TEMPLATE_HEADINGS]];
  const kinds: [ImportKind, string, readonly string[]][] = [
    ["payment", "Payment", LISTS.payment],
    ["expense", "Expense", LISTS.expense],
    ["income", "Income", LISTS.income],
  ];
  for (const [kind, type, categories] of kinds) {
    for (const category of categories) {
      assert.ok(offered.has(category), `${category} is in the dropdown`);
      rows.push([46327 + rows.length, type, category, 10.25, kind === "payment" ? "Kate Lopez" : null, kind === "payment" ? "Zelle" : null, null]);
    }
  }
  const filled = readXlsx(writeXlsx([{ ...sheets[0], rows }, ...sheets.slice(1)]))[0].rows;
  const { lines, problems } = readBudgetRows(filled, findHeadings(filled)!, ROSTER, LISTS);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    lines.map((l) => [l.kind, l.category]),
    kinds.flatMap(([kind, , categories]) => categories.map((c) => [kind, c])),
  );
  assert.equal(lines[0].date, "2026-11-02");
  assert.ok(lines.every((l) => l.cents === 1025));
  assert.ok(lines.filter((l) => l.kind === "payment").every((l) => l.playerId === "p-kate" && l.method === "Zelle"));
  assert.equal(importTotals(lines).expense.cents, 1025 * LISTS.expense.length);
});
