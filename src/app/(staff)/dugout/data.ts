import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { pickTeam, type OwnTeam } from "./team-picker";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Teams we coach, by name. */
export async function loadOwnTeams(supabase: Supabase): Promise<OwnTeam[]> {
  const { data } = await supabase.from("teams").select("id, name").eq("is_own_team", true).order("name");
  return (data ?? []) as OwnTeam[];
}

/**
 * The Dugout page's teams and the one it shows (`?team=`, else the first), or null when we
 * don't coach a team yet (show <NoOwnTeam />).
 */
export async function loadDugoutTeam(
  supabase: Supabase,
  teamParam: string | string[] | undefined,
  /** a team admin's teams (user, 2026-11-12): only these */
  only?: string[],
): Promise<{ teams: OwnTeam[]; team: OwnTeam } | null> {
  const teams = (await loadOwnTeams(supabase)).filter((t) => !only?.length || only.includes(t.id));
  return teams.length ? { teams, team: pickTeam(teams, teamParam) } : null;
}
