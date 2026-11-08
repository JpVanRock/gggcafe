"use server";

// Coaches Dugout → Mentors. Admins approve mentors, turn calendar dates on or
// off, and remove mentors; coaches and admins assign players and can remove any
// message (oversight). The database enforces the same rules.
import { refresh } from "next/cache";
import { adminCheck, headCoachCheck } from "@/lib/auth";
import { friendlyDbError } from "@/lib/form";
import { MESSAGE_PHOTO_BUCKET } from "@/lib/mentors";
import { isUuid } from "@/lib/softball";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

export async function approveMentor(input: { userId: string; displayName: string; specialty: string; canSchedule: boolean }): Promise<Result> {
  const denied = await adminCheck();
  if (denied) return { error: denied };
  const name = input.displayName.trim();
  if (!isUuid(input.userId)) return { error: "Unknown sign-up." };
  if (!name || name.length > 80) return { error: "Enter the mentor's name." };
  const supabase = await createClient();
  const { error } = await supabase.from("mentors").insert({
    user_id: input.userId,
    display_name: name,
    specialty: input.specialty.trim().slice(0, 60) || null,
    can_schedule: Boolean(input.canSchedule),
  });
  if (error) return { error: friendlyDbError(error, "She's already a mentor.") };
  refresh();
  return { error: null };
}

export async function setMentorCalendar(input: { userId: string; on: boolean }): Promise<Result> {
  const denied = await adminCheck();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase.from("mentors").update({ can_schedule: input.on }).eq("user_id", input.userId);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/** Removes a mentor: she loses access to every player. Messages she sent stay for the players. */
export async function removeMentor(input: { userId: string }): Promise<Result> {
  const denied = await adminCheck();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase.from("mentors").delete().eq("user_id", input.userId);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

export async function assignMentorPlayer(input: { mentorId: string; playerId: string }): Promise<Result> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.mentorId) || !isUuid(input.playerId)) return { error: "Pick a player." };
  const supabase = await createClient();
  const { error } = await supabase.from("mentor_players").insert({ mentor_id: input.mentorId, player_id: input.playerId });
  if (error) return { error: friendlyDbError(error, "She's already one of this mentor's players.") };
  refresh();
  return { error: null };
}

export async function unassignMentorPlayer(input: { mentorId: string; playerId: string }): Promise<Result> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase.from("mentor_players").delete().eq("mentor_id", input.mentorId).eq("player_id", input.playerId);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/** Oversight: remove a message (and its photo). */
export async function removeMentorMessage(input: { id: string }): Promise<Result> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.id)) return { error: "Unknown message." };
  const supabase = await createClient();
  const { data } = await supabase.from("mentor_messages").select("photo_path").eq("id", input.id).maybeSingle();
  const { error } = await supabase.from("mentor_messages").delete().eq("id", input.id);
  if (error) return { error: friendlyDbError(error) };
  if (data?.photo_path) await supabase.storage.from(MESSAGE_PHOTO_BUCKET).remove([data.photo_path as string]);
  refresh();
  return { error: null };
}
