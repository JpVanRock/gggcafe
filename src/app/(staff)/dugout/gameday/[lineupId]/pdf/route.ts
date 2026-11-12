import type { NextRequest } from "next/server";
import { getAdminTeamIds, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { loadGamedayRoster, loadLineup } from "@/lib/gameday-data";
import { seasonOrCurrent } from "@/lib/roster";
import { lineupFilename, renderLineupPdf, renderUmpireCardPdf } from "@/lib/pdf/lineup-pdf";

/** The lineup card (or, with ?card=umpire, the umpire exchange card) as a PDF to print or save. Head coaches. */
export async function GET(request: NextRequest, ctx: RouteContext<"/dugout/gameday/[lineupId]/pdf">) {
  const { lineupId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to view this lineup.", { status: 401 });
  if (user.staff?.role === "assistant") return new Response("Not found", { status: 404 });
  // a team admin prints their own team's cards (the database shows them no other lineup)
  const teamAdmin = !user.staff;
  if (teamAdmin && (await getAdminTeamIds()).length === 0) return new Response("Not found", { status: 404 });
  if (!isUuid(lineupId)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const lineup = await loadLineup(supabase, lineupId);
  if (!lineup) return new Response("Not found", { status: 404 });
  const seasonId = await seasonOrCurrent(supabase, lineup.team.id, lineup.season_id);
  const roster = seasonId ? await loadGamedayRoster(supabase, lineup.team.id, seasonId, { teamAdmin }) : [];

  const umpire = request.nextUrl.searchParams.get("card") === "umpire";
  const pdf = umpire ? await renderUmpireCardPdf(lineup, roster) : await renderLineupPdf(lineup, roster);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${umpire ? lineupFilename(lineup).replace(/^lineup-/, "umpire-card-") : lineupFilename(lineup)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
