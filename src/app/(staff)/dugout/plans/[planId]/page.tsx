import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { canEditPlanRole } from "@/lib/roles";
import { Loading } from "@/components/ui";
import { emailConfigured } from "@/lib/email";
import type { LibraryDrill } from "@/lib/dugout";
import { loadCoachNames, loadCoachingStaff, loadPlanRoster, loadPracticePlan } from "@/lib/practice-plans";
import { PlanBuilder } from "./builder";
import { PlanSheet } from "./sheet";

export const metadata: Metadata = { title: "Practice Plan · Coaches Dugout · GGG.Cafe" };

export default function PracticePlanPage({ params, searchParams }: PageProps<"/dugout/plans/[planId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Plan params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function SharedBanner({ shared }: { shared: string }) {
  const n = Number(shared);
  const message =
    shared === "app"
      ? "Your email app opened with the plan. Hit send there to share it."
      : `Emailed to ${n} coach${n === 1 ? "" : "es"} with the PDF attached.`;
  return (
    <p role="status" className="rounded-xl border border-neon/60 bg-neon/10 px-4 py-3 text-sm font-semibold text-ink">
      {message}
    </p>
  );
}

async function Plan({ params, searchParams }: Pick<PageProps<"/dugout/plans/[planId]">, "params" | "searchParams">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { planId } = await params;
  const { shared } = await searchParams;
  if (!isUuid(planId)) notFound();

  const supabase = await createClient();
  const plan = await loadPracticePlan(supabase, planId);
  if (!plan) notFound();
  // Head coaches change any plan; an assistant coach only the plans she wrote (she views the rest).
  const mine = editor && canEditPlanRole(user.staff.role, user.id, plan.created_by);
  const building = mine && plan.status === "draft";

  const [roster, libraryResult, coachNames, staff] = await Promise.all([
    loadPlanRoster(supabase, plan.team.id, plan.spots.map((s) => s.player_id)),
    building
      ? supabase.from("practice_drills").select("id, name, description, tags, equipment, video_url").order("name")
      : Promise.resolve({ data: [] }),
    building ? loadCoachNames(supabase) : Promise.resolve([]),
    mine ? loadCoachingStaff(supabase) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dugout/plans?team=${plan.team.id}`} className="text-sm text-muted hover:text-ink">
        ← Practice plans · {plan.team.name}
      </Link>
      {typeof shared === "string" && plan.status === "final" && <SharedBanner shared={shared} />}
      {editor && !mine && (
        <p className="rounded-xl border border-navy-600 bg-navy-900/70 px-4 py-3 text-sm text-muted">
          Another coach&apos;s plan · view only. Assistant coaches change only the plans they write.
        </p>
      )}
      {building ? (
        <PlanBuilder
          plan={plan}
          library={(libraryResult.data ?? []) as LibraryDrill[]}
          roster={roster}
          coachNames={coachNames}
          staff={staff}
          emailReady={emailConfigured()}
        />
      ) : (
        <PlanSheet plan={plan} roster={roster} canEdit={mine} staff={staff} emailReady={emailConfigured()} />
      )}
    </div>
  );
}
