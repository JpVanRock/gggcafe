"use server";

// The player marks a mentor's message read ("Got it"). Only she can: the database
// lets players change read_at on their own messages and nothing else.
import { refresh } from "next/cache";
import { getMyPlayerIds } from "@/lib/auth";
import { isUuid } from "@/lib/softball";
import { createClient } from "@/lib/supabase/server";

export async function markMessagesRead(input: { playerId: string; ids: string[] }): Promise<{ error: string | null }> {
  if (!isUuid(input.playerId) || !(await getMyPlayerIds()).includes(input.playerId)) return { error: "Only she can mark her messages read." };
  const ids = input.ids.filter(isUuid);
  if (ids.length === 0) return { error: null };
  const supabase = await createClient();
  const { error } = await supabase.from("mentor_messages").update({ read_at: new Date().toISOString() }).eq("player_id", input.playerId).in("id", ids).is("read_at", null);
  if (error) return { error: "Couldn't save that. Try again." };
  refresh();
  return { error: null };
}
