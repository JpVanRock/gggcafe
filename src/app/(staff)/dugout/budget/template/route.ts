// The Team Budget import template (user, 2026-11-13): an Excel workbook with the columns the import
// reads and dropdowns for type, category, method and this season's players. Staff only.
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { compareJersey, isUuid, playerName } from "@/lib/softball";
import { currentSeason } from "@/lib/roster";
import { ENTRY_FORM_CATEGORIES, PAYMENT_CATEGORIES, PAYMENT_METHODS } from "@/lib/budget";
import { budgetTemplate } from "@/lib/budget-import";
import { writeXlsx } from "@/lib/spreadsheet";
import { loadDugoutTeam } from "../../data";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.staff) return new Response("Sign in as a coach to download the template.", { status: 401 });

  const supabase = await createClient();
  const params = request.nextUrl.searchParams;
  const dugout = await loadDugoutTeam(supabase, params.get("team") ?? undefined);
  if (!dugout) return new Response("Not found", { status: 404 });
  const { team } = dugout;
  const seasonParam = params.get("season");
  const seasonId = isUuid(seasonParam) ? seasonParam : await currentSeason(supabase, team.id);

  const [seasonResult, rosterResult] = await Promise.all([
    seasonId ? supabase.from("seasons").select("name").eq("id", seasonId).maybeSingle() : null,
    seasonId
      ? supabase
          .from("roster_entries")
          .select("jersey_number, player:players(first_name, last_name, preferred_name)")
          .eq("team_id", team.id)
          .eq("season_id", seasonId)
          .eq("active", true)
      : null,
  ]);
  const seasonName = seasonResult?.data?.name ?? null;
  const players = (rosterResult?.data ?? [])
    .flatMap((r) => (r.player ? [{ number: r.jersey_number, last: r.player.last_name, name: playerName(r.player) }] : []))
    .sort((a, b) => compareJersey(a.number, b.number) || a.last.localeCompare(b.last))
    .map((p) => p.name);

  const title = `${team.name}${seasonName ? ` · ${seasonName}` : ""} · Team Budget import`;
  const book = writeXlsx(
    budgetTemplate(
      players,
      { payment: PAYMENT_CATEGORIES, expense: ENTRY_FORM_CATEGORIES.expense, income: ENTRY_FORM_CATEGORIES.income, methods: PAYMENT_METHODS },
      title,
    ),
  );
  const filename = `team-budget-${slug([team.name, seasonName].filter(Boolean).join(" ")) || "template"}.xlsx`;
  return new Response(new Uint8Array(book), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
