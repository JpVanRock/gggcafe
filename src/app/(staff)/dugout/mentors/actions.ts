"use server";

// Coaches Dugout → Mentors. Head coaches approve mentors for the whole team (a player's
// parents approve one for her; admins can approve either), remove those approvals, reply to
// a mentor's notes, and remove a message the mentor shared with them. Admins remove mentors.
// The database enforces the same rules.
import { refresh } from "next/cache";
import { adminCheck, headCoachCheck } from "@/lib/auth";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { friendlyDbError, invalid, text, type FormState } from "@/lib/form";
import { MESSAGE_PHOTO_BUCKET, cleanMentorNote } from "@/lib/mentors";
import { isUuid } from "@/lib/softball";
import { createClient } from "@/lib/supabase/server";

/** Approve or decline a mentor's request. */
export async function decideMentorRequest(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "link_id");
    const decision = text(fd, "decision");
    if (!isUuid(id) || (decision !== "approve" && decision !== "decline")) return failed(STALE);
    const supabase = await createClient();
    const { error } = await supabase.rpc("decide_mentor_link", { p_link_id: id, p_approve: decision === "approve" });
    if (error) {
      if (error.code === "P0002") return failed("That request was already decided. Reload the page.");
      if (error.code === "42501") return failed("A player's parents approve a mentor for her. Head coaches approve mentors for the whole team.");
      return failed(friendlyDbError(error));
    }
    refresh();
  });
}

/** Ends a mentor's access to the whole team (head coach) or to one player (admins). */
export async function removeMentorLink(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "link_id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    const { data } = must(await supabase.from("mentor_links").delete().eq("id", id).select("id"));
    if (!data?.length) return failed("Only her parents or an admin can remove a mentor from one player.");
    refresh();
  });
}

/** Admins: remove a mentor account's access everywhere. Messages she sent stay for the players. */
export async function removeMentor(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await adminCheck();
    if (denied) return failed(denied);
    const id = text(fd, "mentor_id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("mentors").delete().eq("user_id", id));
    refresh();
  });
}

/** A head coach replies in a mentor's notes about a player or the team. */
export async function addCoachNote(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const mentorId = text(fd, "mentor_id");
    const playerId = text(fd, "player_id");
    const teamId = text(fd, "team_id");
    if (!isUuid(mentorId) || (playerId ? !isUuid(playerId) : !isUuid(teamId))) return failed(STALE);
    const note = cleanMentorNote({ kind: "note", body: fd.get("body") });
    if ("error" in note) return invalid(note.field, note.error);
    const supabase = await createClient();
    must(
      await supabase
        .from("mentor_notes")
        .insert({ mentor_id: mentorId, player_id: playerId, team_id: playerId ? null : teamId, kind: note.kind, body: note.body }),
    );
    refresh();
  });
}

export async function removeCoachNote(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "note_id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("mentor_notes").delete().eq("id", id));
    refresh();
  });
}

/** Remove a message (and its photo): one a mentor shared with the coaches, or any message for admins. */
export async function removeMentorMessage(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "message_id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    const { data } = await supabase.from("mentor_messages").select("photo_path").eq("id", id).maybeSingle();
    must(await supabase.from("mentor_messages").delete().eq("id", id));
    if (data?.photo_path) await supabase.storage.from(MESSAGE_PHOTO_BUCKET).remove([data.photo_path]);
    refresh();
  });
}
