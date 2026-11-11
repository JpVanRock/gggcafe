import "server-only";
// The version of a team's standards and culture, so a save from an out-of-date page (another
// tab, the phone app, a page left open) can't put back an older list over newer standards
// (user's report, 2026-11-11: adding one standard wiped the others). The form carries the
// version it was loaded with; the save checks it against the database first.
import { createHash } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export function standardsVersion(
  standards: { title: string; detail: string | null }[],
  culture: { headline: string | null; statement: string | null } | null,
): string {
  const content = JSON.stringify([standards.map((s) => [s.title, s.detail ?? ""]), culture?.headline ?? "", culture?.statement ?? ""]);
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}

/** The version as the database has it right now. */
export async function currentStandardsVersion(supabase: Supabase, teamId: string): Promise<string> {
  const [{ data: culture }, { data: standards }] = await Promise.all([
    supabase.from("team_culture").select("headline, statement").eq("team_id", teamId).maybeSingle(),
    supabase.from("team_standards").select("title, detail").eq("team_id", teamId).order("position"),
  ]);
  return standardsVersion(standards ?? [], culture ?? null);
}
