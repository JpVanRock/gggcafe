import "server-only";
// What every family page starts from (user, 2026-11-13, the family menu): the parent's team links,
// her daughters and their logins, her approved teams, and what each team's head coach turned off for
// parents (the Switchboard). Once per request.
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SwitchKey } from "@/lib/switchboard";
import type { FamilyTeam } from "./team-data";

export type Daughter = { player_id: string; player_name: string; team_name: string; on_roster: boolean; username: string | null; has_account: boolean };

export type FamilyLink = {
  link_id: string;
  team_id: string;
  team_name: string;
  child_name: string;
  player_name: string | null;
  status: "pending" | "approved" | "declined";
};

export const firstOf = (name: string) => name.split(" ")[0];

export const loadFamily = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const [linksResult, daughtersResult] = await Promise.all([supabase.rpc("parent_home"), supabase.rpc("parent_player_logins")]);
  const links = (linksResult.data ?? []) as FamilyLink[];
  const daughters = (daughtersResult.data ?? []) as Daughter[];
  const teams: FamilyTeam[] = [
    ...new Map(links.filter((l) => l.status === "approved").map((l) => [l.team_id, { id: l.team_id, name: l.team_name }])).values(),
  ];
  const { data: offRows } = teams.length
    ? await supabase.from("team_features_off").select("team_id, feature").in("team_id", teams.map((t) => t.id))
    : { data: [] as { team_id: string; feature: string }[] };
  const offOn = (teamId: string, feature: SwitchKey) => (offRows ?? []).some((r) => r.team_id === teamId && r.feature === feature);
  /** a daughter's teams (her parent's approved links) */
  const teamsOf = (d: Daughter) => teams.filter((t) => t.name === d.team_name);
  /** off for her when any of her teams turned it off */
  const offForDaughter = (d: Daughter, feature: SwitchKey) => teamsOf(d).some((t) => offOn(t.id, feature));
  /** the teams that leave this parent feature on */
  const teamsWith = (feature: SwitchKey) => teams.filter((t) => !offOn(t.id, feature));
  return { user, supabase, links, daughters, teams, offOn, offForDaughter, teamsOf, teamsWith };
});
