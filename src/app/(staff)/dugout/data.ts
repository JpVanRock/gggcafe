import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { OwnTeam } from "./team-picker";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Teams we coach, by name. */
export async function loadOwnTeams(supabase: Supabase): Promise<OwnTeam[]> {
  const { data } = await supabase.from("teams").select("id, name").eq("is_own_team", true).order("name");
  return (data ?? []) as OwnTeam[];
}
