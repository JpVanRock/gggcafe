import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { lineupSeason, loadGamedayRoster, loadLineup } from "@/lib/gameday-data";
import { lineupFilename, renderLineupPdf } from "@/lib/pdf/lineup-pdf";

/** The lineup card as a PDF, opened in the browser to print or save. Staff only. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/dugout/gameday/[lineupId]/pdf">) {
  const { lineupId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user?.staff) return new Response("Sign in to view this lineup.", { status: 401 });
  if (user.staff.role === "assistant") return new Response("Not found", { status: 404 });
  if (!isUuid(lineupId)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const lineup = await loadLineup(supabase, lineupId);
  if (!lineup) return new Response("Not found", { status: 404 });
  const seasonId = await lineupSeason(supabase, lineup.team.id, lineup.season_id);
  const roster = seasonId ? await loadGamedayRoster(supabase, lineup.team.id, seasonId) : [];

  const pdf = await renderLineupPdf(lineup, roster);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${lineupFilename(lineup)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
