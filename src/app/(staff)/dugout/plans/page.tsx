import type { Metadata } from "next";
import Link from "next/link";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { canEditPlanRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { Disclosure, EmptyState, RECENT_LIMIT, ShowAllLink, badgeClass, cardClass } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import { PRACTICE_SETTING_LABEL, durationLabel, practiceRange, type PracticeSetting } from "@/lib/dugout";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";
import { NewPlanForm } from "./new-plan-form";
import { PlansNav } from "./plans-nav";
import { SafetyNote } from "@/components/legal";

export const metadata: Metadata = { title: "Practice Plans · Coaches Dugout · GGG.Cafe" };

type PlanRow = {
  id: string;
  practice_date: string;
  start_time: string | null;
  setting: PracticeSetting;
  total_minutes: number;
  focus: string | null;
  location: string | null;
  status: "draft" | "final";
  shared_at: string | null;
  created_by: string | null;
  drills: { count: number }[];
};

function StatusChip({ plan }: { plan: PlanRow }) {
  const label = plan.status === "draft" ? "Draft" : plan.shared_at ? "Final · Shared" : "Final";
  return (
    <span
      className={badgeClass(plan.status === "final" ? "neon" : "pink")}
    >
      {label}
    </span>
  );
}

function PlanCard({ plan, viewOnly = false }: { plan: PlanRow; viewOnly?: boolean }) {
  const [weekday, ...rest] = formatDay(plan.practice_date).split(", ");
  const drills = plan.drills[0]?.count ?? 0;
  return (
    <li>
      <Link
        href={`/dugout/plans/${plan.id}`}
        className={`${cardClass("raised")} flex items-center gap-4 p-4 transition hover:border-pink hover:bg-navy-800`}
      >
        <div className="w-16 shrink-0 text-center">
          <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">{weekday}</p>
          <p className="font-display text-lg leading-tight font-bold text-highlight tabular-nums">{rest.join(", ")}</p>
        </div>
        <div className="min-w-0 flex-1 border-l border-navy-700 pl-4">
          <p className="truncate font-semibold text-ink">{plan.focus ?? "Practice"}</p>
          <p className="mt-0.5 text-sm text-muted">
            {[
              practiceRange(plan.start_time, plan.total_minutes),
              PRACTICE_SETTING_LABEL[plan.setting],
              durationLabel(plan.total_minutes),
              `${drills} drill${drills === 1 ? "" : "s"}`,
              plan.location,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <StatusChip plan={plan} />
          {viewOnly && <span className="font-mono text-2xs tracking-wider text-muted uppercase">View only</span>}
        </span>
      </Link>
    </li>
  );
}

export default async function PracticePlansPage({ searchParams }: PageProps<"/dugout/plans">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam, past: pastParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const today = todayISO();

  // Every upcoming plan; past ones newest first, the latest RECENT_LIMIT unless ?past=all.
  const columns = "id, practice_date, start_time, setting, total_minutes, focus, location, status, shared_at, created_by, drills:practice_plan_drills(count)";
  const [upcomingResult, pastResult] = await Promise.all([
    supabase
      .from("practice_plans")
      .select(columns)
      .eq("team_id", team.id)
      .gte("practice_date", today)
      .order("practice_date")
      .order("start_time", { nullsFirst: true }),
    supabase
      .from("practice_plans")
      .select(columns, { count: "exact" })
      .eq("team_id", team.id)
      .lt("practice_date", today)
      .order("practice_date", { ascending: false })
      .order("start_time", { ascending: false, nullsFirst: false })
      .limit(pastParam === "all" ? 2000 : RECENT_LIMIT),
  ]);
  const upcoming = (upcomingResult.data ?? []) as PlanRow[];
  const past = (pastResult.data ?? []) as PlanRow[];
  const pastTotal = pastResult.count ?? past.length;
  // Assistant coaches see every plan but change only their own.
  const viewOnly = (p: PlanRow) => editor && !canEditPlanRole(user.staff.role, user.id, p.created_by);

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/plans" />
      <PlansNav current="plans" teamId={team.id} />
      <SafetyNote audience="coach" />

      {editor && (
        <Disclosure summary={`New practice plan for ${team.name}`} open={upcoming.length === 0 && pastTotal === 0}>
          <NewPlanForm teamId={team.id} today={today} />
        </Disclosure>
      )}

      <section>
        <h2 className="mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Upcoming</h2>
        {upcoming.length ? (
          <ul className="flex flex-col gap-3">
            {upcoming.map((p) => (
              <PlanCard key={p.id} plan={p} viewOnly={viewOnly(p)} />
            ))}
          </ul>
        ) : (
          <EmptyState>No upcoming practice plans.{editor && " Start one above."}</EmptyState>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Past</h2>
          <ul className="flex flex-col gap-3">
            {past.map((p) => (
              <PlanCard key={p.id} plan={p} viewOnly={viewOnly(p)} />
            ))}
          </ul>
          <ShowAllLink shown={past.length} total={pastTotal} href={`/dugout/plans?team=${team.id}&past=all`} noun="past plans" />
        </section>
      )}
    </div>
  );
}
