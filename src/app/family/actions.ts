"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text, type FormState } from "@/lib/form";

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
