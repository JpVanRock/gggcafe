// Team Budget money math. No imports, so it runs in server and client code and
// in unit tests (npm run test:unit). Amounts are handled in whole cents to avoid
// floating-point drift; the database stores numeric(10,2) dollars.

export const EXPENSE_CATEGORIES = [
  "Tournament fees", "League & insurance", "Field & facility", "Umpires", "Equipment", "Uniforms",
  "Training & lessons", "Travel & lodging", "Team events", "Other",
] as const;
export const INCOME_CATEGORIES = ["Fundraiser", "Sponsor", "Donation", "Other"] as const;
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
