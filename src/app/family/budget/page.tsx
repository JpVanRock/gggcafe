import type { Metadata } from "next";
import { BudgetSummary, CreditsSummary, type BudgetSummaryData } from "@/components/budget-summary";
import { EmptyState } from "@/components/ui";
import { loadFamily } from "../family-data";
import { FamilyShell, SectionHeading, SectionTitle } from "../shell";

export const metadata: Metadata = { title: "Team Budget · GGG.Cafe" };

// The family menu's Team Budget (user, 2026-11-13; it was on the family page): team totals, view
// only, with no other families' names, and the team's tournament credits on their own.
export default function FamilyBudgetPage() {
  return (
    <FamilyShell>
      <FamilyBudget />
    </FamilyShell>
  );
}

async function FamilyBudget() {
  const { supabase, teamsWith } = await loadFamily();
  const teams = teamsWith("parent.budget");
  const budgets = await Promise.all(
    teams.map(async (team) => ({
      team,
      summary: (await supabase.rpc("team_budget_summary", { p_team_id: team.id })).data as BudgetSummaryData | null,
    })),
  );
  return (
    <div className="flex flex-col gap-10">
      <SectionTitle title="Team Budget" line="View only. Team totals; individual families' payments stay private." />
      {budgets.length === 0 && <EmptyState>The Team Budget shows here once your coach approves you.</EmptyState>}
      {budgets.map(({ team, summary }) => (
        <section key={team.id} aria-label={`${team.name} Team Budget`} className="flex flex-col gap-4">
          <SectionHeading>
            {team.name}
            {summary ? <span className="text-ink"> · {summary.season}</span> : null}
          </SectionHeading>
          {summary ? <BudgetSummary summary={summary} /> : <p className="text-sm text-muted">The budget isn&apos;t set up yet.</p>}
          {/* tournament credit: its own running balance, apart from the budget (user, 2026-11-12) */}
          {summary?.credits && summary.credits.length > 0 && <CreditsSummary credits={summary.credits} />}
        </section>
      ))}
    </div>
  );
}
