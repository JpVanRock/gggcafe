import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { loadPlanRoster, loadPracticePlan } from "@/lib/practice-plans";
import { practicePlanFilename, renderPracticePlanPdf } from "@/lib/pdf/practice-plan-pdf";

/** The practice plan as a PDF, opened in the browser to print or save. Staff only. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/dugout/plans/[planId]/pdf">) {
  const { planId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user?.staff) return new Response("Sign in to view this practice plan.", { status: 401 });
  if (!isUuid(planId)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const plan = await loadPracticePlan(supabase, planId);
  if (!plan) return new Response("Not found", { status: 404 });
  const roster = await loadPlanRoster(supabase, plan.team.id, plan.spots.map((s) => s.player_id));

  const pdf = await renderPracticePlanPdf(plan, roster);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${practicePlanFilename(plan)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
