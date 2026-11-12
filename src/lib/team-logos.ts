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

/**
 * The team logo for the header's top left (user, 2026-11-12), once per request: for coaches, their own
 * team's (the first, by name, that has a logo); for parents, the team they're approved for. Null when
 * there's no logo, or for anyone else.
 */
export const headerTeamLogo = cache(async (): Promise<{ name: string; url: string } | null> => {
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
