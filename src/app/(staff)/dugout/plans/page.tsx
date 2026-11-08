import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { canEditPlanRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { Disclosure, EmptyState, Loading } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import { PRACTICE_SETTING_LABEL, durationLabel, practiceRange, type PracticeSetting } from "@/lib/dugout";
import { loadOwnTeams } from "../data";
import { TeamPicker } from "../team-picker";
import { NewPlanForm } from "./new-plan-form";

export const metadata: Metadata = { title: "Practice Plans · Coaches Dugout · GGG.Cafe" };

export default function PracticePlansPage({ searchParams }: PageProps<"/dugout/plans">) {
  return (
    <Suspense fallback={<Loading />}>
      <Plans searchParams={searchParams} />
    </Suspense>
  );
}

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
      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${
        plan.status === "final" ? "bg-neon text-on-accent" : "border border-pink text-pink-soft"
      }`}
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
        className="flex items-center gap-4 rounded-xl border border-navy-700 bg-navy-900/70 p-4 transition hover:border-pink hover:bg-navy-800"
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
          {viewOnly && <span className="font-mono text-[10px] tracking-wider text-muted uppercase">View only</span>}
        </span>
      </Link>
    </li>
  );
}

async function Plans({ searchParams }: Pick<PageProps<"/dugout/plans">, "searchParams">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
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
  const today = todayISO();

  const { data } = await supabase
    .from("practice_plans")
    .select("id, practice_date, start_time, setting, total_minutes, focus, location, status, shared_at, created_by, drills:practice_plan_drills(count)")
    .eq("team_id", team.id)
    .order("practice_date", { ascending: false })
    .order("start_time", { ascending: false, nullsFirst: false });
  const plans = (data ?? []) as unknown as PlanRow[];
  const upcoming = plans.filter((p) => p.practice_date >= today).reverse();
  const past = plans.filter((p) => p.practice_date < today);
  // Assistant coaches see every plan but change only their own.
  const viewOnly = (p: PlanRow) => editor && !canEditPlanRole(user.staff.role, user.id, p.created_by);

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/plans" />

      {editor && (
        <Disclosure summary={`New practice plan for ${team.name}`} open={plans.length === 0}>
          <NewPlanForm teamId={team.id} today={today} />
        </Disclosure>
      )}

      <section>
        <h2 className="mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Upcoming</h2>
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
          <h2 className="mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Past</h2>
          <ul className="flex flex-col gap-3">
            {past.map((p) => (
              <PlanCard key={p.id} plan={p} viewOnly={viewOnly(p)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
