"use server";

// Marks the signed-in user's notifications read (RLS: only their own; only read_at can change).
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationsRead(): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Sign in again." };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (error) return { error: "Couldn't mark them read. Try again." };
  refresh();
  return { error: null };
}
