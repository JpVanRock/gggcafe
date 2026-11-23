"use server";

// Her side of her mentors' messages: "Got it" marks one read, and (user, 2026-11-23) she answers in a mentor's
// conversation. Only she can: the database lets players mark their own messages read and write in their own thread,
// only to a mentor approved for her now.
import { refresh } from "next/cache";
import { getMyPlayerIds, switchedOff } from "@/lib/auth";
import { STALE } from "@/lib/actions";
import { friendlyDbError } from "@/lib/form";
import { cleanText } from "@/lib/mentors";
import { isUuid } from "@/lib/softball";
import { createClient } from "@/lib/supabase/server";

export async function markMessagesRead(input: { playerId: string; ids: string[] }): Promise<{ error: string | null }> {
  if (!isUuid(input.playerId) || !(await getMyPlayerIds()).includes(input.playerId)) return { error: "Only she can mark her messages read." };
  const ids = input.ids.filter(isUuid);
  if (ids.length === 0) return { error: null };
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentor_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("player_id", input.playerId)
    .eq("audience", "player")
    .eq("author_role", "mentor")
    .in("id", ids)
    .is("read_at", null);
  if (error) return { error: "Couldn't save that. Try again." };
  refresh();
  return { error: null };
}

/** She answers a mentor (bound to her and the mentor on the page). Answering means she read what the mentor sent. */
export async function answerMentor(playerId: string, mentorId: string, body: string): Promise<{ error: string | null }> {
  if (!isUuid(playerId) || !isUuid(mentorId)) return { error: STALE };
  if (!(await getMyPlayerIds()).includes(playerId)) return { error: "Only she can answer her mentors." };
  const off = await switchedOff("mentor.messages", { playerId });
  if (off) return { error: off };
  const text = cleanText(body);
  if (typeof text === "string") return { error: text };
  const supabase = await createClient();
  const { error } = await supabase.from("mentor_messages").insert({ player_id: playerId, mentor_id: mentorId, author_role: "player", body: text.body });
  if (error) {
    if (error.code === "42501") return { error: "You can't write to this mentor any more: they no longer work with you." };
    return { error: friendlyDbError(error) };
  }
  await supabase
    .from("mentor_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .eq("mentor_id", mentorId)
    .eq("audience", "player")
    .eq("author_role", "mentor")
    .is("read_at", null);
  refresh();
  return { error: null };
}

/** She opened a mentor's conversation: what the mentor sent is read (no refresh: the page already shows it). */
export async function markMentorThreadRead(playerId: string, mentorId: string): Promise<{ error: string | null }> {
  if (!isUuid(playerId) || !isUuid(mentorId) || !(await getMyPlayerIds()).includes(playerId)) return { error: STALE };
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentor_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .eq("mentor_id", mentorId)
    .eq("audience", "player")
    .eq("author_role", "mentor")
    .is("read_at", null);
  if (error) console.error("Marking messages read failed:", error.message);
  return { error: null };
}
