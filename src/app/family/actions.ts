"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { isValidUsername, normalizeUsername } from "@/lib/player-logins";

/** Creates her parent profile if needed, then asks to join a team with its code. */
export async function joinTeam(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Sign in again." };
  const code = text(fd, "code");
  const child = text(fd, "child");
  if (!code) return { error: "Enter the team code from your coach." };
  if (!child) return { error: "Enter your daughter's first and last name." };

  const supabase = await createClient();
  const name = text(fd, "name");
  if (name !== null) {
    if (name.length > 80) return { error: "Keep your name to 80 characters." };
    const { error } = await supabase.from("parent_accounts").upsert({ user_id: user.id, display_name: name });
    if (error) return { error: "Couldn't save your profile. Try again." };
  }

  const { error } = await supabase.rpc("request_parent_link", { p_code: code, p_child_name: child });
  if (error) {
    if (error.code === "P0006") return { error: "That team code doesn't match a team. Check it with your coach." };
    if (error.code === "P0005") return { error: "Enter your name to set up your profile first." };
    return { error: "Couldn't send the request. Try again." };
  }
  refresh();
  return { error: null, saved: true };
}

// ---------------------------------------------------------------------------
// Her login: a parent makes a username login for a daughter without an email.
// The database checks it's her approved parent and she's on the current roster.
// ---------------------------------------------------------------------------

function passwordProblem(fd: FormData): string | null {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return "Use a password of at least 8 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Keep the password under 72 characters.";
  if (password !== String(fd.get("confirm") ?? "")) return "The two passwords don't match.";
  return null;
}

export async function createPlayerLogin(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Sign in again." };
  const playerId = text(fd, "player_id");
  const username = normalizeUsername(String(fd.get("username") ?? ""));
  if (!playerId || !isUuid(playerId)) return { error: "Choose your daughter." };
  if (!isValidUsername(username)) return { error: "Usernames are 3 to 30 letters, numbers, dots, dashes or underscores (no spaces)." };
  const bad = passwordProblem(fd);
  if (bad) return { error: bad };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_player_login", { p_player_id: playerId, p_username: username, p_password: String(fd.get("password")) });
  if (error) {
    if (error.code === "23505") return { error: error.message.includes("taken") ? "That username is taken. Try another." : "She already has a login." };
    if (error.code === "P0006") return { error: "She isn't on the team's current roster yet. Ask your head coach to add her first." };
    if (error.code === "P0007") return { error: "She already has her own account. She signs in with her email." };
    if (error.code === "42501") return { error: "Your coach needs to approve you as her parent first." };
    if (error.code === "22023") return { error: "Check the username and password." };
    return { error: "Couldn't create her login. Try again." };
  }
  refresh();
  return { error: null, saved: true };
}

export async function resetPlayerPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Sign in again." };
  const playerId = text(fd, "player_id");
  if (!playerId || !isUuid(playerId)) return { error: "Choose your daughter." };
  const bad = passwordProblem(fd);
  if (bad) return { error: bad };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_player_password", { p_player_id: playerId, p_password: String(fd.get("password")) });
  if (error) return { error: error.code === "42501" ? "Only her approved parent can do that." : "Couldn't change the password. Try again." };
  return { error: null, saved: true };
}
