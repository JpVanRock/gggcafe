import type { Metadata } from "next";
import Link from "next/link";
import { isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Modal } from "@/components/modal";
import { BudgetSummary, CreditsSummary, type BudgetSummaryData } from "@/components/budget-summary";
import { Card, Disclosure, EmptyState, pillQuietClass, tableClass, tdClass, thClass, badgeClass, type BadgeTone, TableScroll } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import {
  PAYER_ROLE_LABEL, coachLedger, coachTotals, creditLedger, money, paymentCategory, playerBalances, runningLedger, toCents,
  type CoachExpense, type EntryKind, type PayerRole, type PlayerStatus,
} from "@/lib/budget";
import { compareJersey, type Season, playerName } from "@/lib/softball";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";
import { deleteCoachExpense, deleteCredit, deleteEntry, undoCoachRepayment } from "./actions";
import { AdjustmentForm, CoachExpenseForm, CreditForm, EditPaymentForm, EntryForm, FeesForm, PaymentForm, RepayForm, type BudgetPlayer } from "./forms";
import { ActionForm } from "@/components/action-form";
import { BudgetImport } from "./import-panel";

export const metadata: Metadata = { title: "Team Budget · Coaches Dugout · GGG.Cafe" };

type RosterRow = {
  season_id: string;
  jersey_number: string | null;
  player: { id: string; first_name: string; last_name: string; preferred_name: string | null } | null;
};
type CreditRow = { id: string; season_id: string; entry_date: string; kind: "won" | "used"; amount: number; description: string };
type CoachRow = {
  id: string;
  season_id: string;
  entry_date: string;
  paid_by: string;
  paid_by_role: PayerRole;
  category: string | null;
  description: string | null;
  amount: number;
  reimbursed_on: string | null;
  reimbursement_id: string | null;
};
type EntryRow = {
  id: string;
  kind: EntryKind;
  entry_date: string;
  amount: number;
  player_id: string | null;
  category: string | null;
  method: string | null;
  description: string | null;
};

const STATUS: Record<PlayerStatus, { label: string; tone: BadgeTone }> = {
  paid: { label: "Paid", tone: "neon" },
  partial: { label: "Partial", tone: "pink" },
  unpaid: { label: "Unpaid", tone: "neutral" },
  over: { label: "Overpaid", tone: "neonOutline" },
  none: { label: "—", tone: "neutral" },
};

export default async function BudgetPage({ searchParams }: PageProps<"/dugout/budget">) {
  const user = await requireStaffPage();
  // Head coaches and admins change the budget; assistant coaches and viewers read it (user, 2026-11-08).
  const editor = isHeadCoach(user.staff.role);
  const { team: teamParam, season: seasonParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;

  const [seasonsResult, rosterResult] = await Promise.all([
    supabase.from("seasons").select("*").order("start_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase
      .from("roster_entries")
      .select("season_id, jersey_number, player:players(id, first_name, last_name, preferred_name)")
      .eq("team_id", team.id)
      .eq("active", true),
  ]);
  const seasons = (seasonsResult.data ?? []) as Season[];
  const roster = ((rosterResult.data ?? []) as RosterRow[]).filter((r) => r.player);
  const withRoster = seasons.filter((s) => roster.some((r) => r.season_id === s.id));
  const season = seasons.find((s) => s.id === seasonParam) ?? withRoster[0] ?? seasons[0] ?? null;
  if (!season) {
    return (
      <EmptyState>
        Add a season and roster on the{" "}
        <Link href={`/teams/${team.id}`} className="text-link hover:underline">
          team page
        </Link>{" "}
        first.
      </EmptyState>
    );
  }

  const [summaryResult, feesResult, adjustmentsResult, entriesResult, creditsResult, coachResult, staffResult, parentsResult] = await Promise.all([
    supabase.rpc("team_budget_summary", { p_team_id: team.id, p_season_id: season.id }),
    supabase.from("budget_fees").select("name, amount").eq("team_id", team.id).eq("season_id", season.id).order("position"),
    supabase.from("budget_adjustments").select("player_id, amount, note").eq("team_id", team.id).eq("season_id", season.id),
    supabase
      .from("budget_entries")
      .select("id, kind, entry_date, amount, player_id, category, method, description")
      .eq("team_id", team.id)
      .eq("season_id", season.id),
    // tournament credits and out-of-pocket expenses run across seasons
    supabase.from("budget_credits").select("id, season_id, entry_date, kind, amount, description").eq("team_id", team.id),
    supabase
      .from("budget_coach_expenses")
      .select("id, season_id, entry_date, paid_by, paid_by_role, category, description, amount, reimbursed_on, reimbursement_id")
      .eq("team_id", team.id),
    supabase.from("staff").select("display_name").order("display_name"),
    // this team's approved parents, suggested when a parent paid out of pocket
    supabase.from("parent_links").select("parent:parent_accounts(display_name)").eq("team_id", team.id).eq("status", "approved"),
  ]);
  const summary = summaryResult.data as BudgetSummaryData | null;
  const fees = ((feesResult.data ?? []) as { name: string; amount: number }[]).map((f) => ({ name: f.name, cents: toCents(f.amount) }));
  const feeCents = fees.reduce((sum, f) => sum + f.cents, 0);
  const adjustments = (adjustmentsResult.data ?? []) as { player_id: string; amount: number; note: string | null }[];
  const entries = (entriesResult.data ?? []) as EntryRow[];

  const players = roster
    .filter((r) => r.season_id === season.id)
    .sort((a, b) => compareJersey(a.jersey_number, b.jersey_number) || a.player!.last_name.localeCompare(b.player!.last_name));
  const nameOf = new Map(
    roster.map((r) => [r.player!.id, playerName(r.player!)]),
  );
  const options: BudgetPlayer[] = players.map((r) => ({
    id: r.player!.id,
    label: `${r.jersey_number ? `#${r.jersey_number} ` : ""}${nameOf.get(r.player!.id)}`,
  }));
  const balances = playerBalances(
    players.map((r) => r.player!.id),
    feeCents,
    new Map(adjustments.map((a) => [a.player_id, toCents(a.amount)])),
    entries.filter((e) => e.kind === "payment").map((e) => ({ player_id: e.player_id, cents: toCents(e.amount), category: e.category })),
  );
  const anyOtherPayments = balances.some((b) => b.other > 0);
  const ledger = runningLedger(entries.map((e) => ({ ...e, date: e.entry_date, cents: toCents(e.amount) })));
  const seasonName = new Map(seasons.map((s) => [s.id, s.name]));
  const credits = creditLedger(((creditsResult.data ?? []) as CreditRow[]).map((c) => ({ ...c, date: c.entry_date, cents: toCents(c.amount) })));
  const creditLeft = credits.length ? credits[credits.length - 1].balance : 0;
  const coachRows = (coachResult.data ?? []) as CoachRow[];
  const coachItems: CoachExpense[] = coachRows.map((c) => ({
    id: c.id,
    date: c.entry_date,
    paidBy: c.paid_by,
    role: c.paid_by_role,
    item: c.description || c.category || "Expense",
    cents: toCents(c.amount),
    repaidOn: c.reimbursed_on,
  }));
  const coachRowsById = new Map(coachRows.map((c) => [c.id, c]));
  const coach = coachLedger(coachItems);
  const coachSums = coachTotals(coachItems);
  const owedItems = coachItems
    .filter((c) => !c.repaidOn)
    .sort((a, b) => a.paidBy.localeCompare(b.paidBy) || a.date.localeCompare(b.date))
    .map((c) => ({ id: c.id, label: `${c.paidBy} (${PAYER_ROLE_LABEL[c.role ?? "coach"].toLowerCase()}) · ${formatDay(c.date)} · ${c.item} · ${money(c.cents)}` }));
  const staffNames = ((staffResult.data ?? []) as { display_name: string }[]).map((s) => s.display_name);
  const parentNames = [
    ...new Set(((parentsResult.data ?? []) as { parent: { display_name: string } | null }[]).flatMap((l) => (l.parent ? [l.parent.display_name] : []))),
  ].sort();
  const scope = { teamId: team.id, seasonId: season.id };
  const today = todayISO();
  const base = `/dugout/budget?team=${team.id}`;

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/budget" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">{season.name}</h2>
          <p className="mt-1 text-sm text-muted">{team.name} · Team Budget</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {seasons.length > 1 && (
            <nav aria-label="Season" className="flex flex-wrap gap-1.5">
              {seasons.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  href={`${base}&season=${s.id}`}
                  aria-current={s.id === season.id ? "page" : undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    s.id === season.id ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
                  }`}
                >
                  {s.name}
                </Link>
              ))}
            </nav>
          )}
          {summary && (
            <Modal title="What parents see" subtitle={`${team.name} · ${season.name}`} trigger="Parent view" triggerClassName={pillQuietClass}>
              <p className="mb-5 text-sm text-muted">
                Approved parents see team totals only: no names, and player payments as daily totals. Tournament credits show on their
                own, below the budget.
              </p>
              <div className="flex flex-col gap-6">
                <BudgetSummary summary={summary} />
                {summary.credits && summary.credits.length > 0 && <CreditsSummary credits={summary.credits} />}
              </div>
            </Modal>
          )}
        </div>
      </div>

      {summary && <BudgetSummary summary={summary} showLedger={false} />}
      {creditLeft > 0 && (
        <p className="-mt-4 text-sm text-muted">
          The team also has <span className="font-semibold text-ink tabular-nums">{money(creditLeft)}</span> in tournament credit, kept
          apart from the team balance.
        </p>
      )}

      {/* Left: registration costs, then everything that's an expense or changes what a player owes, and
          outstanding reimbursements. Right: money coming in, then tournament credit and out-of-pocket
          expenses (user, 2026-11-12). */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          {/* collapsible like the other sections (user, 2026-11-12); open until costs are set */}
          <Disclosure summary={`Registration costs${fees.length ? ` · ${money(feeCents)} per player` : ""}`} open={fees.length === 0}>
            {editor ? (
              <FeesForm key={season.id} scope={scope} fees={fees} />
            ) : fees.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {fees.map((f) => (
                  <li key={f.name} className="flex justify-between">
                    <span>{f.name}</span>
                    <span className="tabular-nums">{money(f.cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Not set yet.</EmptyState>
            )}
          </Disclosure>
          {editor && (
            <>
              <Disclosure summary="Add an expense">
                <EntryForm scope={scope} today={today} kind="expense" />
              </Disclosure>
              <Disclosure summary="Discount or extra charge for a player">
                <AdjustmentForm scope={scope} players={options} />
              </Disclosure>
              <Disclosure summary={`Outstanding Reimbursements${coachSums.owed ? ` · ${money(coachSums.owed)} owed` : ""}`}>
                <RepayForm key={owedItems.map((o) => o.id).join()} items={owedItems} today={today} />
              </Disclosure>
            </>
          )}
        </div>

        {editor && (
          <div className="flex flex-col gap-3">
            <Disclosure summary="Record a player payment" open>
              <PaymentForm scope={scope} players={options} today={today} />
            </Disclosure>
            <Disclosure summary="Add fundraisers or other income">
              <EntryForm scope={scope} today={today} kind="income" />
            </Disclosure>
            <Disclosure summary="Tournament credit won or used">
              <CreditForm scope={scope} today={today} balance={creditLeft} />
            </Disclosure>
            <Disclosure summary="Out of Pocket Expenses">
              <CoachExpenseForm scope={scope} today={today} coachNames={staffNames} parentNames={parentNames} defaultName={user.staff.displayName} />
            </Disclosure>
          </div>
        )}
      </div>

      {/* many lines at once from Excel or CSV (user, 2026-11-13; import-panel.tsx) */}
      {editor && (
        <Disclosure summary="Import from a spreadsheet">
          <BudgetImport scope={scope} templateHref={`/dugout/budget/template?team=${team.id}&season=${season.id}`} />
        </Disclosure>
      )}

      <Card title={`Player payments (${players.length})`}>
        {players.length === 0 ? (
          <EmptyState>No active players on this season&apos;s roster.</EmptyState>
        ) : (
          <TableScroll label="Player payments">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Player</th>
                  <th className={`${thClass} text-right`}>Owes</th>
                  <th className={`${thClass} text-right`}>Paid</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                  <th className={thClass}>Status</th>
                  {anyOtherPayments && <th className={`${thClass} text-right`}>Equipment &amp; other</th>}
                </tr>
              </thead>
              <tbody>
                {balances.map((b, i) => {
                  const adj = adjustments.find((a) => a.player_id === b.id);
                  return (
                    <tr key={b.id}>
                      <td className={tdClass}>
                        {options[i].label}
                        {adj && (
                          <span className="ml-2 text-xs text-muted">
                            {toCents(adj.amount) < 0 ? "−" : "+"}
                            {money(Math.abs(toCents(adj.amount)))}
                            {adj.note ? ` ${adj.note}` : ""}
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{money(b.due)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{money(b.paid)}</td>
                      <td className={`${tdClass} text-right font-semibold tabular-nums ${b.owed > 0 ? "text-pink-soft" : ""}`}>{money(b.owed)}</td>
                      <td className={tdClass}>
                        <span className={badgeClass(STATUS[b.status].tone)}>
                          {STATUS[b.status].label}
                        </span>
                      </td>
                      {anyOtherPayments && <td className={`${tdClass} text-right tabular-nums`}>{b.other ? money(b.other) : "–"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      <Card title="Ledger">
        {ledger.length === 0 ? (
          <EmptyState>Nothing recorded yet. Payments, income and expenses show here with a running balance.</EmptyState>
        ) : (
          <TableScroll label="Ledger">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Item</th>
                  <th className={`${thClass} text-right`}>In</th>
                  <th className={`${thClass} text-right`}>Out</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                  {editor && <th className={thClass}>
                    <span className="sr-only">Edit or remove</span>
                  </th>}
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => {
                  const item =
                    e.kind === "payment"
                      ? `Payment · ${e.player_id ? (nameOf.get(e.player_id) ?? "Former player") : "Former player"}`
                      : e.description || e.category || (e.kind === "income" ? "Income" : "Expense");
                  const detail = [
                    e.kind === "payment" ? paymentCategory(e.category) : e.description ? e.category : null,
                    e.kind === "payment" ? e.method : null,
                    e.kind === "payment" ? e.description : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={e.id}>
                      <td className={`${tdClass} whitespace-nowrap`}>{formatDay(e.date)}</td>
                      <td className={tdClass}>
                        {item}
                        {detail && <span className="ml-2 text-xs text-muted">{detail}</span>}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{e.kind === "expense" ? "" : money(e.cents)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{e.kind === "expense" ? money(e.cents) : ""}</td>
                      <td className={`${tdClass} text-right font-semibold tabular-nums ${e.balance < 0 ? "text-danger" : ""}`}>{money(e.balance)}</td>
                      {editor && (
                        <td className={tdClass}>
                          <div className="flex items-center gap-3">
                            {e.kind === "payment" && (
                              <Modal
                                title="Edit payment"
                                subtitle={`${item} · ${money(e.cents)} · ${formatDay(e.date)}`}
                                trigger="Edit"
                                triggerLabel={`Edit ${item}, ${money(e.cents)}`}
                                triggerClassName="text-xs text-link hover:underline"
                              >
                                <EditPaymentForm id={e.id} category={paymentCategory(e.category)} method={e.method} note={e.description} />
                              </Modal>
                            )}
                            <ActionForm action={deleteEntry}>
                              <input type="hidden" name="id" value={e.id} />
                              <ConfirmSubmit message={`Remove “${item}” (${money(e.cents)}) from the ledger?`} className="text-xs text-danger hover:underline">
                                Remove
                              </ConfirmSubmit>
                            </ActionForm>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      <Card title="Tournament credits">
        <div className="flex flex-col gap-4">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-4xl font-bold text-highlight tabular-nums">{money(creditLeft)}</span>
            <span className="text-sm text-muted">credit balance, all seasons · not part of the team balance</span>
          </p>
          {credits.length === 0 ? (
            <EmptyState>
              No tournament credit yet. When the team wins credit toward a future entry fee, add it as credit won; spending it on an
              entry fee is credit used. Credit is kept apart from the team balance.
            </EmptyState>
          ) : (
            <TableScroll label="Tournament credits">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Date</th>
                    <th className={thClass}>Tournament</th>
                    <th className={`${thClass} text-right`}>Won</th>
                    <th className={`${thClass} text-right`}>Used</th>
                    <th className={`${thClass} text-right`}>Balance</th>
                    {editor && (
                      <th className={thClass}>
                        <span className="sr-only">Remove</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {credits.map((c) => (
                    <tr key={c.id}>
                      <td className={`${tdClass} whitespace-nowrap`}>{formatDay(c.date)}</td>
                      <td className={tdClass}>
                        {c.description}
                        {c.season_id !== season.id && <span className="ml-2 text-xs text-muted">{seasonName.get(c.season_id)}</span>}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{c.kind === "won" ? money(c.cents) : ""}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{c.kind === "used" ? money(c.cents) : ""}</td>
                      <td className={`${tdClass} text-right font-semibold tabular-nums`}>{money(c.balance)}</td>
                      {editor && (
                        <td className={tdClass}>
                          <ActionForm action={deleteCredit}>
                            <input type="hidden" name="id" value={c.id} />
                            <ConfirmSubmit
                              message={`Remove this tournament credit (${money(c.cents)}) from the credit balance?`}
                              className="text-xs text-danger hover:underline"
                            >
                              Remove
                            </ConfirmSubmit>
                          </ActionForm>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      </Card>

      <Card title="Out of Pocket Expenses">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            What coaches and parents paid for with their own money, kept apart from the team balance. The team owes it back until
            it&apos;s repaid; only a repayment from team money comes out of the team balance, because that money leaves the team.
          </p>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Spent", coachSums.spent],
              ["Repaid", coachSums.repaid],
              ["Still owed", coachSums.owed],
            ].map(([label, cents]) => (
              <div key={label as string} className="flex min-w-0 items-baseline justify-between gap-3 rounded-xl border border-navy-700 bg-navy-950/50 p-3 sm:block">
                <dt className="text-2xs font-semibold tracking-[0.14em] text-muted uppercase">{label}</dt>
                <dd className={`mt-1 font-display text-2xl font-bold tabular-nums ${label === "Still owed" && (cents as number) > 0 ? "text-highlight" : ""}`}>
                  {money(cents as number)}
                </dd>
              </div>
            ))}
          </dl>
          {coachSums.owedTo.length > 0 && (
            <p className="text-sm">
              Owed to{" "}
              {coachSums.owedTo.map((o, i) => (
                <span key={o.name}>
                  {i > 0 && (i === coachSums.owedTo.length - 1 ? " and " : ", ")}
                  <span className="font-semibold">{o.name}</span> <span className="tabular-nums">{money(o.cents)}</span>
                </span>
              ))}
              .
            </p>
          )}
          {coach.length === 0 ? (
            <EmptyState>Nothing yet. When a coach or a parent pays for something the team needs, add it here so the team can pay it back.</EmptyState>
          ) : (
            <TableScroll label="Out of Pocket Expenses">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Date</th>
                    <th className={thClass}>Paid by</th>
                    <th className={thClass}>Item</th>
                    <th className={`${thClass} text-right`}>Spent</th>
                    <th className={`${thClass} text-right`}>Repaid</th>
                    <th className={`${thClass} text-right`}>Owed</th>
                    {editor && (
                      <th className={thClass}>
                        <span className="sr-only">Change</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {coach.map((r) => {
                    const row = coachRowsById.get(r.expense.id);
                    return (
                      <tr key={r.key}>
                        <td className={`${tdClass} whitespace-nowrap`}>{formatDay(r.date)}</td>
                        <td className={tdClass}>
                          {r.expense.paidBy}
                          <span className="ml-2 text-xs text-muted">{PAYER_ROLE_LABEL[r.expense.role ?? "coach"]}</span>
                        </td>
                        <td className={tdClass}>
                          {r.type === "repaid" ? `Repaid: ${r.expense.item}` : r.expense.item}
                          {r.type === "spent" && row?.category && <span className="ml-2 text-xs text-muted">{row.category}</span>}
                          {r.type === "repaid" && !row?.reimbursement_id && <span className="ml-2 text-xs text-muted">not from team money</span>}
                          {row && row.season_id !== season.id && <span className="ml-2 text-xs text-muted">{seasonName.get(row.season_id)}</span>}
                        </td>
                        <td className={`${tdClass} text-right tabular-nums`}>{r.type === "spent" ? money(r.expense.cents) : ""}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{r.type === "repaid" ? money(r.expense.cents) : ""}</td>
                        <td className={`${tdClass} text-right font-semibold tabular-nums`}>{money(r.owed)}</td>
                        {editor && (
                          <td className={tdClass}>
                            {r.type === "spent" && !r.expense.repaidOn && (
                              <ActionForm action={deleteCoachExpense}>
                                <input type="hidden" name="id" value={r.expense.id} />
                                <ConfirmSubmit
                                  message={`Remove “${r.expense.item}” (${money(r.expense.cents)}) from Out of Pocket Expenses?`}
                                  className="text-xs text-danger hover:underline"
                                >
                                  Remove
                                </ConfirmSubmit>
                              </ActionForm>
                            )}
                            {r.type === "repaid" && (
                              <ActionForm action={undoCoachRepayment}>
                                <input type="hidden" name="id" value={r.expense.id} />
                                <ConfirmSubmit
                                  message={
                                    row?.reimbursement_id
                                      ? "Undo this repayment? Its Out-of-pocket reimbursement expense comes out of the team ledger, and every item it covered is owed again."
                                      : "Undo this repayment? The item is owed again."
                                  }
                                  className="text-xs text-danger hover:underline"
                                >
                                  Undo
                                </ConfirmSubmit>
                              </ActionForm>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      </Card>
    </div>
  );
}
