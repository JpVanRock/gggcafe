import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Modal } from "@/components/modal";
import { BudgetSummary, type BudgetSummaryData } from "@/components/budget-summary";
import { Card, Disclosure, EmptyState, Loading, pillQuietClass, tableClass, tdClass, thClass } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import { money, playerBalances, runningLedger, toCents, type EntryKind, type PlayerStatus } from "@/lib/budget";
import { compareJersey, type Season } from "@/lib/softball";
import { loadOwnTeams } from "../data";
import { TeamPicker } from "../team-picker";
import { deleteEntry } from "./actions";
import { AdjustmentForm, EntryForm, FeesForm, PaymentForm, type BudgetPlayer } from "./forms";

export const metadata: Metadata = { title: "Team Budget · Coaches Dugout · GGG.Cafe" };

export default function BudgetPage({ searchParams }: PageProps<"/dugout/budget">) {
  return (
    <Suspense fallback={<Loading />}>
      <Budget searchParams={searchParams} />
    </Suspense>
  );
}

type RosterRow = {
  season_id: string;
  jersey_number: string | null;
  player: { id: string; first_name: string; last_name: string; preferred_name: string | null } | null;
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

const STATUS: Record<PlayerStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-neon text-on-accent" },
  partial: { label: "Partial", className: "border border-pink text-pink-soft" },
  unpaid: { label: "Unpaid", className: "border border-navy-600 text-muted" },
  over: { label: "Overpaid", className: "border border-neon text-highlight" },
  none: { label: "—", className: "text-muted" },
};

async function Budget({ searchParams }: Pick<PageProps<"/dugout/budget">, "searchParams">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam, season: seasonParam } = await searchParams;
  const supabase = await createClient();
  const teams = await loadOwnTeams(supabase);
  if (teams.length === 0) {
    return (
      <EmptyState>
        Add your team on the{" "}
        <Link href="/teams" className="text-pink hover:underline">
          Teams
        </Link>{" "}
        page first (mark it as one of our teams).
      </EmptyState>
    );
  }
  const team = teams.find((t) => t.id === teamParam) ?? teams[0];

  const [seasonsResult, rosterResult] = await Promise.all([
    supabase.from("seasons").select("*").order("start_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase
      .from("roster_entries")
      .select("season_id, jersey_number, player:players(id, first_name, last_name, preferred_name)")
      .eq("team_id", team.id)
      .eq("active", true),
  ]);
  const seasons = (seasonsResult.data ?? []) as Season[];
  const roster = ((rosterResult.data ?? []) as unknown as RosterRow[]).filter((r) => r.player);
  const withRoster = seasons.filter((s) => roster.some((r) => r.season_id === s.id));
  const season = seasons.find((s) => s.id === seasonParam) ?? withRoster[0] ?? seasons[0] ?? null;
  if (!season) {
    return (
      <EmptyState>
        Add a season and roster on the{" "}
        <Link href={`/teams/${team.id}`} className="text-pink hover:underline">
          team page
        </Link>{" "}
        first.
      </EmptyState>
    );
  }

  const [summaryResult, feesResult, adjustmentsResult, entriesResult] = await Promise.all([
    supabase.rpc("team_budget_summary", { p_team_id: team.id, p_season_id: season.id }),
    supabase.from("budget_fees").select("name, amount").eq("team_id", team.id).eq("season_id", season.id).order("position"),
    supabase.from("budget_adjustments").select("player_id, amount, note").eq("team_id", team.id).eq("season_id", season.id),
    supabase
      .from("budget_entries")
      .select("id, kind, entry_date, amount, player_id, category, method, description")
      .eq("team_id", team.id)
      .eq("season_id", season.id),
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
    roster.map((r) => [r.player!.id, `${r.player!.preferred_name || r.player!.first_name} ${r.player!.last_name}`]),
  );
  const options: BudgetPlayer[] = players.map((r) => ({
    id: r.player!.id,
    label: `${r.jersey_number ? `#${r.jersey_number} ` : ""}${nameOf.get(r.player!.id)}`,
  }));
  const balances = playerBalances(
    players.map((r) => r.player!.id),
    feeCents,
    new Map(adjustments.map((a) => [a.player_id, toCents(a.amount)])),
    entries.filter((e) => e.kind === "payment").map((e) => ({ player_id: e.player_id, cents: toCents(e.amount) })),
  );
  const ledger = runningLedger(entries.map((e) => ({ ...e, date: e.entry_date, cents: toCents(e.amount) })));
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
                Approved parents see team totals only: no names, and player payments as daily totals.
              </p>
              <BudgetSummary summary={summary} />
            </Modal>
          )}
        </div>
      </div>

      {summary && <BudgetSummary summary={summary} showLedger={false} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Registration costs">
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
        </Card>

        {editor && (
          <div className="flex flex-col gap-3">
            <Disclosure summary="Record a player payment" open>
              <PaymentForm scope={scope} players={options} today={today} />
            </Disclosure>
            <Disclosure summary="Add an expense or other income">
              <EntryForm scope={scope} today={today} />
            </Disclosure>
            <Disclosure summary="Discount or extra charge for a player">
              <AdjustmentForm scope={scope} players={options} />
            </Disclosure>
          </div>
        )}
      </div>

      <Card title={`Player payments (${players.length})`}>
        {players.length === 0 ? (
          <EmptyState>No active players on this season&apos;s roster.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Player</th>
                  <th className={`${thClass} text-right`}>Owes</th>
                  <th className={`${thClass} text-right`}>Paid</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                  <th className={thClass}>Status</th>
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
                        <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${STATUS[b.status].className}`}>
                          {STATUS[b.status].label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Ledger">
        {ledger.length === 0 ? (
          <EmptyState>Nothing recorded yet. Payments, income and expenses show here with a running balance.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Item</th>
                  <th className={`${thClass} text-right`}>In</th>
                  <th className={`${thClass} text-right`}>Out</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                  {editor && <th className={thClass}>
                    <span className="sr-only">Remove</span>
                  </th>}
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => {
                  const item =
                    e.kind === "payment"
                      ? `Payment · ${e.player_id ? (nameOf.get(e.player_id) ?? "Former player") : "Former player"}`
                      : e.description || e.category || (e.kind === "income" ? "Income" : "Expense");
                  const detail = [e.kind === "payment" ? e.method : e.description ? e.category : null, e.kind === "payment" ? e.description : null]
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
                          <form action={deleteEntry}>
                            <input type="hidden" name="id" value={e.id} />
                            <ConfirmSubmit message={`Remove “${item}” (${money(e.cents)}) from the ledger?`} className="text-xs text-danger hover:underline">
                              Remove
                            </ConfirmSubmit>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
