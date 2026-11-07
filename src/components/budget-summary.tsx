// The Team Budget at a glance: registration cost, collected vs expected, what's
// still owed, other income, expenses, balance, and the running ledger. This is
// exactly what approved parents see (team totals only: player payments appear
// as daily totals with no names), and the top of the coaches' budget page.
// Server-safe. Data comes from the team_budget_summary() database function.
import { formatDay } from "@/lib/dates";
import { money, runningLedger, toCents, type EntryKind } from "@/lib/budget";

export type BudgetSummaryData = {
  team: string;
  season: string;
  season_id: string;
  players: number;
  fees: { name: string; amount: number }[];
  fee_per_player: number;
  expected: number;
  collected: number;
  other_income: number;
  expenses: number;
  entries: { date: string; kind: EntryKind; category: string | null; description: string | null; amount: number }[];
};

function Stat({ label, value, note, tone = "ink" }: { label: string; value: string; note?: string; tone?: "ink" | "highlight" | "danger" }) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-900/70 p-4">
      <p className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">{label}</p>
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Registration"
          value={money(toCents(summary.fee_per_player))}
          note={summary.fees.length ? summary.fees.map((f) => `${f.name} ${money(toCents(f.amount))}`).join(" · ") : "Not set yet"}
        />
        <div className="rounded-xl border border-navy-700 bg-navy-900/70 p-4">
          <p className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Collected</p>
          <p className="mt-1 font-display text-2xl font-bold text-highlight tabular-nums">{money(t.collected)}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-800" aria-hidden>
            <div className="h-full rounded-full bg-neon" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {pct}% of {money(t.expected)} expected · {summary.players} player{summary.players === 1 ? "" : "s"}
          </p>
        </div>
        <Stat label="Still owed" value={money(t.owed)} note="Registration not yet paid" />
        <Stat label="Other income" value={money(t.other)} note="Sponsors, fundraisers, donations" />
        <Stat label="Expenses" value={money(t.spent)} />
        <Stat label="Balance" value={money(t.balance)} note="Money in minus money out" tone={t.balance < 0 ? "danger" : "highlight"} />
      </div>

      {showLedger && (
        <section aria-label="Ledger">
          <h3 className="mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Ledger</h3>
          {ledger.length === 0 ? (
            <p className="rounded-md border border-dashed border-navy-600 p-6 text-center text-sm text-muted">Nothing recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-navy-700 text-[0.75rem] leading-4 font-semibold tracking-wider text-muted uppercase">
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
            </div>
          )}
        </section>
      )}
    </div>
  );
}
