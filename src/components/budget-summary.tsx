// The Team Budget at a glance: registration cost, collected vs expected, what's
// still owed, other income, expenses, balance, and the running ledger. This is
// exactly what approved parents see (team totals only: player payments appear
// as daily totals with no names), and the top of the coaches' budget page.
// Server-safe. Data comes from the team_budget_summary() database function.
import type { ReactNode } from "react";
import { Modal } from "@/components/modal";
import { formatDay, formatLongDateAt } from "@/lib/dates";
import { creditLedger, money, runningLedger, toCents, type CreditKind, type EntryKind } from "@/lib/budget";
import { TableScroll, cardClass, EmptyState } from "@/components/ui";

export type BudgetSummaryData = {
  team: string;
  season: string;
  season_id: string;
  /** when anything in this season's budget last changed (null before the first change) */
  updated_at?: string | null;
  players: number;
  fees: { name: string; amount: number }[];
  fee_per_player: number;
  expected: number;
  collected: number;
  other_income: number;
  expenses: number;
  entries: { date: string; kind: EntryKind; category: string | null; description: string | null; amount: number }[];
  /** the team's tournament credits, all seasons: shown on their own, never in the budget's totals */
  credits?: { date: string; kind: CreditKind; amount: number; description: string }[];
};

function Stat({
  label,
  value,
  note,
  tone = "ink",
  action,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "ink" | "highlight" | "danger";
  action?: ReactNode;
}) {
  return (
    <div className={`${cardClass("raised")} relative p-4`}>
      {action && <div className="absolute top-3 right-3">{action}</div>}
      {/* leave room for the Details button in the corner */}
      <p className={`font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase ${action ? "pr-20" : ""}`}>{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-bold tabular-nums ${
          tone === "highlight" ? "text-highlight" : tone === "danger" ? "text-danger" : "text-ink"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

type Entry = BudgetSummaryData["entries"][number];

/** Player payments for equipment or other things count as income, so the income details list them too. */
const PAYMENT_GROUP: Record<string, string> = { Equipment: "Equipment payments", Other: "Other player payments" };
const isIncomeLine = (e: Entry) => e.kind === "income" || (e.kind === "payment" && !!e.category && e.category in PAYMENT_GROUP);

/**
 * "Details": every expense (or income) line item in a pop-up, grouped by category with subtotals. Always
 * there (user, 2026-11-12), saying so when nothing is recorded yet.
 */
function LineItems({ title, kind, entries, team }: { title: string; kind: "expense" | "income"; entries: Entry[]; team: string }) {
  const items = entries.filter((e) => (kind === "income" ? isIncomeLine(e) : e.kind === "expense")).sort((a, b) => a.date.localeCompare(b.date));
  const groups = new Map<string, Entry[]>();
  for (const e of items) {
    const key = e.kind === "payment" ? PAYMENT_GROUP[e.category!] : e.category || "Other";
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const total = items.reduce((sum, e) => sum + toCents(e.amount), 0);
  return (
    <Modal
      title={title}
      subtitle={`${team} · ${items.length} item${items.length === 1 ? "" : "s"} · ${money(total)}`}
      trigger="Details"
      // the name must contain the visible "Details" (WCAG label in name)
      triggerLabel={`${title} details`}
      triggerClassName="rounded-full border border-navy-600 px-2.5 py-0.5 text-xs font-semibold text-muted transition hover:border-pink hover:text-ink"
    >
      <div className="flex flex-col gap-6">
        {items.length === 0 && <EmptyState>Nothing recorded yet.</EmptyState>}
        {[...groups.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([category, rows]) => (
            <section key={category}>
              <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-navy-700 pb-1.5">
                <h3 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">{category}</h3>
                <span className="font-display text-sm font-bold tabular-nums">{money(rows.reduce((sum, e) => sum + toCents(e.amount), 0))}</span>
              </div>
              <ul className="flex flex-col">
                {rows.map((e, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-4 border-b border-navy-800 py-2 text-sm last:border-0">
                    <span className="min-w-0">
                      <span className="mr-3 whitespace-nowrap text-muted">{formatDay(e.date)}</span>
                      {e.description || category}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{money(toCents(e.amount))}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        <p className="flex justify-between border-t-2 border-navy-600 pt-3 font-semibold">
          <span>Total</span>
          <span className="font-display tabular-nums">{money(total)}</span>
        </p>
      </div>
    </Modal>
  );
}

export function budgetTotals(s: BudgetSummaryData) {
  const expected = toCents(s.expected);
  const collected = toCents(s.collected);
  const other = toCents(s.other_income);
  const spent = toCents(s.expenses);
  return { expected, collected, other, spent, owed: Math.max(0, expected - collected), balance: collected + other - spent };
}

export function BudgetSummary({ summary, showLedger = true }: { summary: BudgetSummaryData; showLedger?: boolean }) {
  const t = budgetTotals(summary);
  const pct = t.expected > 0 ? Math.min(100, Math.round((t.collected / t.expected) * 100)) : 0;
  const ledger = runningLedger(summary.entries.map((e) => ({ ...e, cents: toCents(e.amount) })));

  return (
    <div className="flex flex-col gap-6">
      {summary.updated_at && (
        <p className="-mb-2 text-sm text-muted">
          Last updated <span className="font-semibold text-ink">{formatLongDateAt(summary.updated_at)}</span>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Registration"
          value={money(toCents(summary.fee_per_player))}
          note={summary.fees.length ? summary.fees.map((f) => `${f.name} ${money(toCents(f.amount))}`).join(" · ") : "Not set yet"}
        />
        <div className={`${cardClass("raised")} p-4`}>
          <p className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Collected</p>
          <p className="mt-1 font-display text-2xl font-bold text-highlight tabular-nums">{money(t.collected)}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-800" aria-hidden>
            <div className="h-full rounded-full bg-neon" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {pct}% of {money(t.expected)} expected · {summary.players} player{summary.players === 1 ? "" : "s"}
          </p>
        </div>
        <Stat label="Still owed" value={money(t.owed)} note="Registration not yet paid" />
        <Stat
          label="Fundraisers or other income"
          value={money(t.other)}
          note="Fundraisers, sponsors, donations, reimbursements"
          action={<LineItems title="Fundraisers or other income" kind="income" entries={summary.entries} team={summary.team} />}
        />
        <Stat
          label="Expenses"
          value={money(t.spent)}
          note={summary.entries.some((e) => e.kind === "expense") ? "Tap Details for each item" : undefined}
          action={<LineItems title="Expenses" kind="expense" entries={summary.entries} team={summary.team} />}
        />
        <Stat label="Balance" value={money(t.balance)} note="Money in minus money out" tone={t.balance < 0 ? "danger" : "highlight"} />
      </div>

      {showLedger && (
        <section aria-label="Ledger">
          <h3 className="mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Ledger</h3>
          {ledger.length === 0 ? (
            <EmptyState>Nothing recorded yet.</EmptyState>
          ) : (
            <TableScroll label="Ledger">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-navy-700 text-2xs font-semibold tracking-wider text-muted uppercase">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4 text-right">In</th>
                    <th className="py-2 pr-4 text-right">Out</th>
                    <th className="py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e, i) => (
                    <tr key={i} className="border-b border-navy-800">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDay(e.date)}</td>
                      <td className="py-2 pr-4">
                        {e.kind === "payment" ? e.description : e.description || e.category}
                        {e.kind !== "payment" && e.description && e.category && <span className="ml-2 text-xs text-muted">{e.category}</span>}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{e.kind === "expense" ? "" : money(e.cents)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{e.kind === "expense" ? money(e.cents) : ""}</td>
                      <td className={`py-2 text-right font-semibold tabular-nums ${e.balance < 0 ? "text-danger" : ""}`}>{money(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Tournament credit the team won toward future entry fees and the credit it used, with its running
 * balance across seasons. Shown apart from the budget (user, 2026-11-12): credit isn't money, so it
 * never counts in the budget's income, expenses or balance. Parents see it on the family page.
 */
export function CreditsSummary({ credits }: { credits: NonNullable<BudgetSummaryData["credits"]> }) {
  const rows = creditLedger(credits.map((c) => ({ ...c, cents: toCents(c.amount) })));
  const balance = rows.length ? rows[rows.length - 1].balance : 0;
  return (
    <section aria-label="Tournament credits" className={`${cardClass("raised")} flex flex-col gap-4 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Tournament credits</h3>
        <p className="text-xs text-muted">Kept apart from the team budget · all seasons</p>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-3xl font-bold text-highlight tabular-nums">{money(balance)}</span>
        <span className="text-sm text-muted">credit toward future tournament entry fees</span>
      </p>
      {rows.length > 0 && (
        <TableScroll label="Tournament credits">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700 text-left font-mono text-2xs tracking-[0.15em] text-muted uppercase">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Tournament</th>
                <th className="py-2 pr-3 text-right font-semibold">Won</th>
                <th className="py-2 pr-3 text-right font-semibold">Used</th>
                <th className="py-2 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-navy-800 last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatDay(r.date)}</td>
                  <td className="py-2 pr-3">{r.description}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.kind === "won" ? money(r.cents) : ""}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.kind === "used" ? money(r.cents) : ""}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{money(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </section>
  );
}
