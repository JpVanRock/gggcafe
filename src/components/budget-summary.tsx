// The Team Budget at a glance: registration cost, collected vs expected, what's
// still owed, other income, expenses, balance, and the running ledger. This is
// exactly what approved parents see (team totals only: player payments appear
// as daily totals with no names), and the top of the coaches' budget page.
// Server-safe. Data comes from the team_budget_summary() database function.
import type { ReactNode } from "react";
import { Modal } from "@/components/modal";
import { formatDay, formatLongDateAt } from "@/lib/dates";
import { money, runningLedger, toCents, type EntryKind } from "@/lib/budget";
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
      <p className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">{label}</p>
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

/** "Details": every expense (or income) line item in a pop-up, grouped by category with subtotals. */
function LineItems({ title, kind, entries, team }: { title: string; kind: "expense" | "income"; entries: Entry[]; team: string }) {
  const items = entries.filter((e) => e.kind === kind).sort((a, b) => a.date.localeCompare(b.date));
  if (items.length === 0) return null;
  const groups = new Map<string, Entry[]>();
  for (const e of items) {
    const key = e.category || "Other";
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
          label="Other income"
          value={money(t.other)}
          note="Sponsors, fundraisers, donations"
          action={<LineItems title="Other income" kind="income" entries={summary.entries} team={summary.team} />}
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
