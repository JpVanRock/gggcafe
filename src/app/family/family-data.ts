import "server-only";
// What every family page starts from (user, 2026-11-13, the family menu): the parent's team links,
// her daughters and their logins, her approved teams, and what each team's head coach turned off for
// parents (the Switchboard). Once per request.
// Player accounts go to their own pages (user, 2026-11-16: players see only the player view), and a
// parent's first visit joins the team with the code and name from sign-up (no second form).
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isPlayerLoginEmail } from "@/lib/player-logins";
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

type SignupMeta = { role?: string; display_name?: string; team_code?: string; child?: string };

/**
 * The signed-in account for a family page, with what it typed at sign-up. A player's own login
 * (her sign-up, or a username her parent made) sees only her player pages: it goes to /me.
 */
export const familyAccount = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const meta = (data?.claims?.user_metadata ?? {}) as SignupMeta;
  if (!user.staff && (meta.role === "player" || isPlayerLoginEmail(user.email))) redirect("/me");
  return { user, supabase, meta };
});

export const loadFamily = cache(async () => {
  const { user, supabase, meta } = await familyAccount();
  const loadLinks = () => Promise.all([supabase.rpc("parent_home"), supabase.rpc("parent_player_logins")]);
  let [linksResult, daughtersResult] = await loadLinks();

  // First visit after confirming the email: join with what they typed at sign-up. Only while they
  // have no parent profile yet, so a parent the head coach removed isn't joined again.
  let joinError: "no-match" | "failed" | null = null;
  if (!linksResult.data?.length && meta.team_code && meta.child) {
    const { data: profile } = await supabase.from("parent_accounts").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!profile) {
      const name = (meta.display_name ?? "").trim().slice(0, 80) || user.email?.split("@")[0] || "Parent";
      await supabase.from("parent_accounts").insert({ display_name: name });
      const { error } = await supabase.rpc("request_parent_link", { p_code: meta.team_code, p_child_name: meta.child });
      if (error) joinError = error.code === "P0006" ? "no-match" : "failed";
      else [linksResult, daughtersResult] = await loadLinks();
    }
  }
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
  return { user, supabase, meta, joinError, links, daughters, teams, offOn, offForDaughter, teamsOf, teamsWith };
});
