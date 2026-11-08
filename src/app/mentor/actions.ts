"use server";

// Mentor actions: message a player (text, a photo, a suggested drill; a new drill
// goes into the Drill Library first), add or remove a date on her TWIS (only with
// the admin's calendar permission), and take back a message. The database checks
// all of it again (her players only; sender name and drill details from the DB).
import { refresh } from "next/cache";
import { getMentor, mentorCheck } from "@/lib/auth";
import { friendlyDbError } from "@/lib/form";
import { MESSAGE_PHOTO_BUCKET, cleanMessage, cleanNewDrill, mentorDate } from "@/lib/mentors";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

export async function sendMentorMessage(input: {
  playerId: string;
  body?: string;
  photoPath?: string;
  drillId?: string;
  newDrill?: { name?: string; videoUrl?: string; description?: string } | null;
}): Promise<Result> {
  const denied = await mentorCheck(input.playerId);
  if (denied) return { error: denied };
  const mentor = (await getMentor())!;
  const supabase = await createClient();

  let drillId = input.drillId;
  if (input.newDrill) {
    const drill = cleanNewDrill(input.newDrill);
    if (typeof drill === "string") return { error: drill };
    const { data, error } = await supabase.from("practice_drills").insert(drill).select("id").single();
    if (error) return { error: error.code === "23505" ? "There's already a drill with that name in the library. Pick it from the list." : friendlyDbError(error) };
    drillId = data.id as string;
  }

  const message = cleanMessage({ body: input.body, photoPath: input.photoPath, drillId }, mentor.userId);
  if (typeof message === "string") return { error: message };
  const { error } = await supabase
    .from("mentor_messages")
    .insert({ player_id: input.playerId, body: message.body, photo_path: message.photoPath, drill_id: message.drillId });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/** Take back a message she sent (and its photo). */
export async function deleteMentorMessage(input: { id: string }): Promise<Result> {
  const denied = await mentorCheck();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { data } = await supabase.from("mentor_messages").select("photo_path").eq("id", input.id).maybeSingle();
  const { error } = await supabase.from("mentor_messages").delete().eq("id", input.id);
  if (error) return { error: friendlyDbError(error) };
  if (data?.photo_path) await supabase.storage.from(MESSAGE_PHOTO_BUCKET).remove([data.photo_path as string]);
  refresh();
  return { error: null };
}

/** A date on her player's TWIS (needs the admin's calendar permission). */
export async function addMentorDate(input: { playerId: string; title: string; date: string; note?: string }): Promise<Result> {
  const denied = await mentorCheck(input.playerId);
  if (denied) return { error: denied };
  const mentor = (await getMentor())!;
  if (!mentor.canSchedule) return { error: "Adding dates isn't turned on for you. Ask an admin." };
  const row = mentorDate(input, mentor.displayName);
  if (typeof row === "string") return { error: row };
  const supabase = await createClient();
  const { error } = await supabase.from("player_activities").insert({ player_id: input.playerId, ...row });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

export async function removeMentorDate(input: { id: string }): Promise<Result> {
  const denied = await mentorCheck();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase.from("player_activities").delete().eq("id", input.id).eq("source", "mentor");
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}
