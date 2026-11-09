"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text, type FormState, invalid } from "@/lib/form";
import { isUuid } from "@/lib/softball";

export type ClaimState = FormState & { matched?: boolean };

/** The team code from her coach opens that team's welcome and claim form (/me?team=…). */
export async function findTeam(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Sign in again." };
  const code = text(fd, "code");
  if (!code) return invalid("code", "Enter the team code from your coach.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("signup_team", { p_code: code });
  if (error) return { error: "Couldn't check the team code. Try again in a moment." };
  const team = data?.[0];
  if (!team) return invalid("code", "That team code doesn't match a team. Check it with your coach.");
  redirect(`/me?team=${team.id}`);
}

/** A player claims her spot on a team's current roster by name and jersey number. */
export async function claimSpot(_prev: ClaimState, fd: FormData): Promise<ClaimState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Sign in again." };
  const teamId = text(fd, "team_id");
  const name = text(fd, "name");
  const jersey = text(fd, "jersey");
  if (!isUuid(teamId)) return { error: "Choose your team." };
  if (!name || !/\s/.test(name)) return invalid("name", "Enter your first and last name.");
  if (!jersey || !/^#?\d{1,2}$/.test(jersey)) return invalid("jersey", "Enter your jersey number (0–99).");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_player_claim", { p_team_id: teamId, p_name: name, p_jersey: jersey });
  if (error) {
    if (error.code === "P0007") return { error: "Your team's roster isn't set up yet. Check back after your coach adds you." };
    if (error.code === "P0006") return { error: "That team isn't available. Pick your team again." };
    return { error: "Couldn't send your claim. Try again." };
  }
  refresh();
  return { error: null, saved: true, matched: Boolean(data) };
}
