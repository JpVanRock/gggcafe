"use server";

// Mentor actions: ask to work with a team or one player (team code), message a player (text,
// a photo, a suggested drill; shared with the coaches only if she chooses), training on her
// players' weeks (one player or a group), and notes and focus areas for the coaches. The
// database checks all of it again (her players only; names and authors from the database).
import { refresh } from "next/cache";
import { getMentor, mentorCheck } from "@/lib/auth";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { friendlyDbError, invalid, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { MESSAGE_PHOTO_BUCKET, cleanFocus, cleanMentorNote, cleanMentorRequest, cleanMessage, cleanNewDrill, isFocusStatus, mentorTraining } from "@/lib/mentors";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

// ---------------------------------------------------------------------------
// Asking to mentor
// ---------------------------------------------------------------------------

/** Ask to work with a whole team (the head coach approves) or one player (her parents approve). */
export async function requestMentor(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const req = cleanMentorRequest({ code: fd.get("code"), scope: fd.get("scope"), player: fd.get("player") });
    if ("error" in req) return invalid(req.field, req.error);
    const supabase = await createClient();
    const { error } = await supabase.rpc("request_mentor", { p_code: req.code, p_player_name: req.playerName ?? "" });
    if (error) {
      if (error.code === "P0006") return invalid("code", "That team code doesn't match a team. Check it with the coach or a parent.");
      if (error.code === "P0007") return invalid("player", "She isn't on that team's roster under that name. Use her name as the team has it.");
      if (error.code === "P0008") return invalid("player", "Two players on that team have that name. Ask her parents which name to use.");
      if (error.code === "42501") return failed("Only mentor accounts can ask. Sign up as a mentor first.");
      return failed(friendlyDbError(error));
    }
    refresh();
  });
}

/** Withdraw a request, or stop working with a team or player. */
export async function withdrawMentorLink(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const id = text(fd, "link_id");
    if (!isUuid(id)) return failed(STALE);
    const mentor = await getMentor();
    if (!mentor) return failed("Only mentors can do that.");
    const supabase = await createClient();
    must(await supabase.from("mentor_links").delete().eq("id", id).eq("mentor_id", mentor.userId));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function sendMentorMessage(input: {
  playerId: string;
  body?: string;
  photoPath?: string;
  drillId?: string;
  newDrill?: { name?: string; videoUrl?: string; description?: string } | null;
  share?: boolean;
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
    drillId = data.id;
  }

  const message = cleanMessage({ body: input.body, photoPath: input.photoPath, drillId }, mentor.userId);
  if (typeof message === "string") return { error: message };
  const { error } = await supabase.from("mentor_messages").insert({
    player_id: input.playerId,
    body: message.body,
    photo_path: message.photoPath,
    drill_id: message.drillId,
    shared_with_coaches: Boolean(input.share),
  });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/** Take back a message she sent (and its photo). */
export async function deleteMentorMessage(input: { id: string }): Promise<Result> {
  const mentor = await getMentor();
  if (!mentor) return { error: "Only mentors can do that." };
  if (!isUuid(input.id)) return { error: "Unknown message." };
  const supabase = await createClient();
  const { data } = await supabase.from("mentor_messages").select("photo_path").eq("id", input.id).eq("sender_id", mentor.userId).maybeSingle();
  const { error } = await supabase.from("mentor_messages").delete().eq("id", input.id).eq("sender_id", mentor.userId);
  if (error) return { error: friendlyDbError(error) };
  if (data?.photo_path) await supabase.storage.from(MESSAGE_PHOTO_BUCKET).remove([data.photo_path]);
  refresh();
  return { error: null };
}

/** Share a message with the coaches, or make it private again (parents and admins always see it). */
export async function setMessageSharing(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const id = text(fd, "message_id");
    if (!isUuid(id)) return failed(STALE);
    const mentor = await getMentor();
    if (!mentor) return failed("Only mentors can do that.");
    const supabase = await createClient();
    must(await supabase.from("mentor_messages").update({ shared_with_coaches: fd.get("shared") === "1" }).eq("id", id).eq("sender_id", mentor.userId));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Training on her players' weeks: one player or a group
// ---------------------------------------------------------------------------

export async function addMentorTraining(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const players = [...new Set(fd.getAll("player_id").filter((v): v is string => typeof v === "string" && isUuid(v)))];
    if (players.length === 0) return invalid("player_id", "Pick at least one player.");
    for (const id of players) {
      const denied = await mentorCheck(id);
      if (denied) return failed(denied);
    }
    const mentor = (await getMentor())!;
    const row = mentorTraining(
      { title: fd.get("title"), date: fd.get("date"), note: fd.get("note"), repeat: fd.get("repeat"), until: fd.get("until"), days: fd.getAll("days") },
      mentor.displayName,
    );
    if ("error" in row) return invalid(row.field, row.error);
    const supabase = await createClient();
    must(await supabase.from("player_activities").insert(players.map((player_id) => ({ player_id, ...row }))));
    refresh();
  });
}

/** Removes training she added: one player's date, or the same session for the whole group. */
export async function removeMentorTraining(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const ids = fd.getAll("activity_id").filter((v): v is string => typeof v === "string" && isUuid(v));
    if (ids.length === 0) return failed(STALE);
    const mentor = await getMentor();
    if (!mentor) return failed("Only mentors can do that.");
    const supabase = await createClient();
    must(await supabase.from("player_activities").delete().in("id", ids).eq("source", "mentor").eq("created_by", mentor.userId));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Working with the coaches: notes and focus areas (one player or the whole team)
// ---------------------------------------------------------------------------

/** The player or team a note or focus area is about, if it's hers; else an error. */
async function scopeOf(fd: FormData): Promise<{ player_id: string | null; team_id: string | null } | FormState> {
  const playerId = text(fd, "player_id");
  const teamId = text(fd, "team_id");
  if (playerId ? !isUuid(playerId) || teamId : !isUuid(teamId)) return failed(STALE);
  const denied = await mentorCheck(playerId ?? undefined, teamId ?? undefined);
  if (denied) return failed(denied);
  return { player_id: playerId, team_id: playerId ? null : teamId };
}

export async function addMentorNote(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const scope = await scopeOf(fd);
    if ("error" in scope) return scope;
    const note = cleanMentorNote({ kind: fd.get("kind"), body: fd.get("body"), discussedOn: fd.get("discussed_on") });
    if ("error" in note) return invalid(note.field, note.error);
    const mentor = (await getMentor())!;
    const supabase = await createClient();
    must(await supabase.from("mentor_notes").insert({ mentor_id: mentor.userId, ...scope, ...note }));
    refresh();
  });
}

export async function removeMentorNote(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const id = text(fd, "note_id");
    if (!isUuid(id)) return failed(STALE);
    const mentor = await getMentor();
    if (!mentor) return failed("Only mentors can do that.");
    const supabase = await createClient();
    must(await supabase.from("mentor_notes").delete().eq("id", id).eq("author_id", mentor.userId));
    refresh();
  });
}

export async function addMentorFocus(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const scope = await scopeOf(fd);
    if ("error" in scope) return scope;
    const focus = cleanFocus({ title: fd.get("title"), details: fd.get("details"), status: fd.get("status") });
    if ("error" in focus) return invalid(focus.field, focus.error);
    const supabase = await createClient();
    must(await supabase.from("mentor_focus").insert({ ...scope, ...focus }));
    refresh();
  });
}

/** Moves a focus area between "Working on" and "What's working". */
export async function setMentorFocus(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const id = text(fd, "focus_id");
    const status = fd.get("status");
    if (!isUuid(id) || !isFocusStatus(status)) return failed(STALE);
    const mentor = await getMentor();
    if (!mentor) return failed("Only mentors can do that.");
    const supabase = await createClient();
    must(await supabase.from("mentor_focus").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("mentor_id", mentor.userId));
    refresh();
  });
}

export async function removeMentorFocus(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const id = text(fd, "focus_id");
    if (!isUuid(id)) return failed(STALE);
    const mentor = await getMentor();
    if (!mentor) return failed("Only mentors can do that.");
    const supabase = await createClient();
    must(await supabase.from("mentor_focus").delete().eq("id", id).eq("mentor_id", mentor.userId));
    refresh();
  });
}
