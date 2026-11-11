// Team Budget money math. No imports, so it runs in server and client code and
// in unit tests (npm run test:unit). Amounts are handled in whole cents to avoid
// floating-point drift; the database stores numeric(10,2) dollars.

export const EXPENSE_CATEGORIES = [
  "Tournament fees", "League & insurance", "Field & facility", "Umpires", "Equipment", "Uniforms",
  "Training & lessons", "Travel & lodging", "Team events", "Coach reimbursement", "Tournament credit used", "Other",
] as const;
export const INCOME_CATEGORIES = ["Fundraiser", "Sponsor", "Donation", "Reimbursement", "Tournament credit", "Other"] as const;

// Tournament credits (user, 2026-11-11): credit the team wins toward future entry fees is income
// in the team ledger, and credit spent on an entry fee is an expense. creditLedger() keeps their
// own running balance across seasons. Coaches' out-of-pocket spending has its own ledger
// (budget_coach_expenses); repaying a coach from team money is a "Coach reimbursement" expense.
export const CREDIT_WON = "Tournament credit";
export const CREDIT_USED = "Tournament credit used";
export const COACH_REIMBURSEMENT = "Coach reimbursement";
/** Categories with their own forms (credits, coach repayments), left out of the general expense/income form. */
const OWN_FORM: readonly string[] = [CREDIT_WON, CREDIT_USED, COACH_REIMBURSEMENT];
export const ENTRY_FORM_CATEGORIES = {
  expense: EXPENSE_CATEGORIES.filter((c) => !OWN_FORM.includes(c)),
  income: INCOME_CATEGORIES.filter((c) => !OWN_FORM.includes(c)),
};
export const PAYMENT_METHODS = ["Cash", "Check", "Venmo", "Zelle", "PayPal", "Card", "Other"] as const;

export type EntryKind = "payment" | "income" | "expense";

/** Dollars (number or numeric string from the database) to whole cents. */
export function toCents(dollars: number | string | null | undefined) {
  const n = typeof dollars === "string" ? Number(dollars) : (dollars ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Cents to a dollars string for the database: 12550 -> "125.50". */
export function centsToDollars(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * What a coach typed ("$1,250.5", "40") to cents. null when blank, "invalid"
 * when it isn't an amount. Negative only when allowed (discounts).
 */
export function parseMoney(input: string | null | undefined, { allowNegative = false } = {}): number | null | "invalid" {
  const s = (input ?? "").trim().replace(/[$,\s]/g, "");
  if (!s) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return "invalid";
  const negative = s.startsWith("-");
  if (negative && !allowNegative) return "invalid";
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -cents : cents;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
/** 12550 -> "$125.50"; -500 -> "-$5.00" */
export function money(cents: number) {
  return usd.format(cents / 100);
}

export type PlayerStatus = "paid" | "partial" | "unpaid" | "over" | "none";

/** Each player's due (fees + her adjustment), paid and owed, in cents. */
export function playerBalances(
  playerIds: string[],
  feeCents: number,
  adjustments: Map<string, number>,
  payments: { player_id: string | null; cents: number }[],
) {
  return playerIds.map((id) => {
    const due = Math.max(0, feeCents + (adjustments.get(id) ?? 0));
    const paid = payments.filter((p) => p.player_id === id).reduce((sum, p) => sum + p.cents, 0);
    const owed = due - paid;
    const status: PlayerStatus =
      due === 0 && paid === 0 ? "none" : owed === 0 ? "paid" : owed < 0 ? "over" : paid > 0 ? "partial" : "unpaid";
    return { id, due, paid, owed, status };
  });
}

/** Ledger rows in date order with a running balance (money in minus money out). */
export function runningLedger<T extends { date: string; kind: EntryKind; cents: number }>(entries: T[]) {
  let balance = 0;
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "expense" ? 1 : 0) - (b.kind === "expense" ? 1 : 0))
    .map((e) => {
      balance += e.kind === "expense" ? -e.cents : e.cents;
      return { ...e, balance };
    });
}

/** A tournament-credit line: credit won (income) or credit used (expense). */
export function isCredit(e: { kind: EntryKind; category: string | null }) {
  return (e.kind === "income" && e.category === CREDIT_WON) || (e.kind === "expense" && e.category === CREDIT_USED);
}

/** Tournament credit lines in date order with the running credit balance (won minus used). */
export function creditLedger<T extends { date: string; kind: EntryKind; category: string | null; cents: number }>(entries: T[]) {
  let balance = 0;
  return entries
    .filter(isCredit)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "expense" ? 1 : 0) - (b.kind === "expense" ? 1 : 0))
    .map((e) => {
      balance += e.kind === "income" ? e.cents : -e.cents;
      return { ...e, balance };
    });
}

/** The tournament credit the team still has. */
export function creditBalance(entries: { date: string; kind: EntryKind; category: string | null; cents: number }[]) {
  const rows = creditLedger(entries);
  return rows.length ? rows[rows.length - 1].balance : 0;
}

export type CoachExpense = {
  id: string;
  date: string;
  paidBy: string;
  item: string;
  cents: number;
  /** the date it was repaid, or null while the team still owes it */
  repaidOn: string | null;
};

/**
 * The coaches' out-of-pocket ledger: each expense adds to what the team owes its coaches, each
 * repayment takes it off again, in date order with a running "owed" balance.
 */
export function coachLedger(items: CoachExpense[]) {
  const rows = items.flatMap((e) => [
    { key: `${e.id}:spent`, type: "spent" as const, date: e.date, expense: e },
    ...(e.repaidOn ? [{ key: `${e.id}:repaid`, type: "repaid" as const, date: e.repaidOn, expense: e }] : []),
  ]);
  let owed = 0;
  return rows
    .sort((a, b) => a.date.localeCompare(b.date) || (a.type === "repaid" ? 1 : 0) - (b.type === "repaid" ? 1 : 0))
    .map((r) => {
      owed += r.type === "spent" ? r.expense.cents : -r.expense.cents;
      return { ...r, owed };
    });
}

/** Totals for the coaches' ledger, and what's still owed to each person. */
export function coachTotals(items: CoachExpense[]) {
  const spent = items.reduce((sum, e) => sum + e.cents, 0);
  const repaid = items.filter((e) => e.repaidOn).reduce((sum, e) => sum + e.cents, 0);
  const byPerson = new Map<string, number>();
  for (const e of items) if (!e.repaidOn) byPerson.set(e.paidBy, (byPerson.get(e.paidBy) ?? 0) + e.cents);
  return {
    spent,
    repaid,
    owed: spent - repaid,
    owedTo: [...byPerson].map(([name, cents]) => ({ name, cents })).sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name)),
  };
}
