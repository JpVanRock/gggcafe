import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const LOGO_BUCKET = "team-logos";

/**
 * A short-lived link to a team's logo in the private team-logos bucket (Storage lets any
 * signed-in user read it; signed-out visitors get nothing). Null when there's no logo.
 */
export async function signedLogoUrl(supabase: Supabase, path: string | null | undefined, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, expiresIn);
  if (error) {
    console.error("Signing the team logo failed:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

export type TeamLogo = { name: string; url: string };

/**
 * The signed-in user's own team logo, once per request: beside the Coaches Dugout title for coaches
 * and team admins, beside the family page's title for parents (user, 2026-11-13). For coaches, their
 * own team's (the first, by name, that has a logo); for parents, the team they're approved for. Null
 * when there's no logo, or for anyone else.
 */
export const myTeamLogo = cache(async (): Promise<TeamLogo | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  let team: { name: string; logo_path: string | null } | null = null;
  if (user.staff) {
    const { data } = await supabase
      .from("teams")
      .select("name, logo_path")
      .eq("is_own_team", true)
      .not("logo_path", "is", null)
      .order("name")
      .limit(1)
      .maybeSingle();
    team = data;
  } else {
    const { data } = await supabase.rpc("parent_team_logos");
    const first = (data ?? [])[0];
    team = first ? { name: first.team_name, logo_path: first.logo_path } : null;
  }
  if (!team?.logo_path) return null;
  const url = await signedLogoUrl(supabase, team.logo_path);
  return url ? { name: team.name, url } : null;
});

/**
 * A player's team logo for her dashboard (user, 2026-11-13): the first of her active teams, by name,
 * that has one. Staff and the player read her teams directly; her parent (viewing as her) can't read
 * teams, so it's their approved team's logo (parent_team_logos), hers when they have daughters on
 * more than one team.
 */
export async function playerTeamLogo(supabase: Supabase, playerId: string, parentView: boolean): Promise<TeamLogo | null> {
  let team: { name: string; logo_path: string } | null = null;
  if (parentView) {
    const [{ data: logos }, { data: spots }] = await Promise.all([
      supabase.rpc("parent_team_logos"),
      supabase.from("roster_entries").select("team_id").eq("player_id", playerId).eq("active", true),
    ]);
    const hers = new Set((spots ?? []).map((s) => s.team_id));
    const pick = (logos ?? []).find((l) => hers.has(l.team_id)) ?? (logos ?? [])[0];
    team = pick ? { name: pick.team_name, logo_path: pick.logo_path } : null;
  } else {
    const { data } = await supabase.from("roster_entries").select("team:teams(name, logo_path, is_own_team)").eq("player_id", playerId).eq("active", true);
    const withLogo = (data ?? [])
      .map((r) => r.team)
      .filter((t): t is { name: string; logo_path: string; is_own_team: boolean } => Boolean(t?.is_own_team && t.logo_path))
      .sort((a, b) => a.name.localeCompare(b.name));
    team = withLogo[0] ?? null;
  }
  if (!team) return null;
  const url = await signedLogoUrl(supabase, team.logo_path);
  return url ? { name: team.name, url } : null;
}
