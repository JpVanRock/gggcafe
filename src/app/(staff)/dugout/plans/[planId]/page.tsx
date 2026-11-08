import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { canEditPlanRole } from "@/lib/roles";
import { Card, Loading, sectionLabelClass } from "@/components/ui";
import { emailConfigured } from "@/lib/email";
import type { LibraryDrill } from "@/lib/dugout";
import { loadCoachNames, loadCoachingStaff, loadPlanRoster, loadPracticePlan } from "@/lib/practice-plans";
import { PlanBuilder } from "./builder";
import { PlanSheet } from "./sheet";
import { PlanExtrasForm, type PlanNotes } from "./notes";

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

  const [roster, libraryResult, coachNames, staff, notesResult, cuesResult, installsResult, pickedResult] = await Promise.all([
    loadPlanRoster(supabase, plan.team.id, plan.spots.map((s) => s.player_id)),
    building
      ? supabase.from("practice_drills").select("id, name, description, tags, equipment, video_url").order("name")
      : Promise.resolve({ data: [] }),
    building ? loadCoachNames(supabase) : Promise.resolve([]),
    mine ? loadCoachingStaff(supabase) : Promise.resolve([]),
    supabase.from("practice_plans").select("objective, rule_of_day, announcements, coach_notes").eq("id", planId).maybeSingle(),
    supabase.from("practice_plan_cues").select("player_id, cue").eq("plan_id", planId),
    supabase.from("install_items").select("id, group_name, title, status").eq("team_id", plan.team.id).order("position"),
    supabase.from("install_item_plans").select("item_id").eq("plan_id", planId),
  ]);
  const notes = (notesResult.data ?? { objective: null, rule_of_day: null, announcements: null, coach_notes: null }) as PlanNotes;
  const cues = Object.fromEntries(((cuesResult.data ?? []) as { player_id: string; cue: string }[]).map((c) => [c.player_id, c.cue]));
  const installs = ((installsResult.data ?? []) as { id: string; group_name: string; title: string; status: string }[]).map((i) => ({
    id: i.id,
    group: i.group_name,
    title: i.title,
    status: i.status,
  }));
  const picked = ((pickedResult.data ?? []) as { item_id: string }[]).map((r) => r.item_id);

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
      <Card title="Notes for players">
        {mine ? (
          <PlanExtrasForm
            planId={plan.id}
            notes={notes}
            cues={cues}
            roster={roster.map((r) => ({ id: r.id, short: r.short }))}
            installs={installs}
            picked={picked}
          />
        ) : (
          <PlanExtrasView notes={notes} cues={cues} roster={roster} installs={installs.filter((i) => picked.includes(i.id))} />
        )}
      </Card>
    </div>
  );
}

function PlanExtrasView({
  notes,
  cues,
  roster,
  installs,
}: {
  notes: PlanNotes;
  cues: Record<string, string>;
  roster: { id: string; short: string }[];
  installs: { id: string; group: string; title: string }[];
}) {
  const rows: [string, string | null][] = [
    ["Objective", notes.objective],
    ["Rule of the day", notes.rule_of_day],
    ["Announcements", notes.announcements],
    ["Coach notes", notes.coach_notes],
  ];
  const withCue = roster.filter((r) => cues[r.id]);
  if (rows.every(([, v]) => !v) && withCue.length === 0 && installs.length === 0) {
    return <p className="text-sm text-muted">No notes for this practice.</p>;
  }
  return (
    <div className="flex flex-col gap-4 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows
          .filter(([, v]) => v)
          .map(([label, v]) => (
            <div key={label}>
              <dt className={sectionLabelClass}>{label}</dt>
              <dd className="mt-1 whitespace-pre-line text-ink/90">{v}</dd>
            </div>
          ))}
      </dl>
      {withCue.length > 0 && (
        <div>
          <p className={sectionLabelClass}>Cues</p>
          <ul className="mt-1 space-y-0.5">
            {withCue.map((r) => (
              <li key={r.id}>
                <span className="text-muted">{r.short}</span> · {cues[r.id]}
              </li>
            ))}
          </ul>
        </div>
      )}
      {installs.length > 0 && (
        <div>
          <p className={sectionLabelClass}>Installs this practice</p>
          <p className="mt-1">{installs.map((i) => `${i.group}: ${i.title}`).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
