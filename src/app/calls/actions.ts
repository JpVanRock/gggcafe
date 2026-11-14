"use server";

// Video calls (user, 2026-11-12; docs/features/video-calls.md): scheduling, cancelling and
// joining. Mentors and head coaches schedule; the database checks again who may (RLS: an admin
// turned video calls on for every one of her teams, and for a mentor the head coach switched them
// on for mentors), one call at a time and a time still ahead (trigger), and who may join
// (video_call_role).
import { refresh } from "next/cache";
import { getCurrentUser, getMentor, getMyPlayerIds, isHeadCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, invalid, text, type FormState } from "@/lib/form";
import { STALE, failed, runAction } from "@/lib/actions";
import { isUuid, playerName } from "@/lib/softball";
import { CALL_MAX_PLAYERS, callCalendars, callState, cleanCallInput } from "@/lib/video-calls";
import { ZOOM_NOT_CONNECTED, createZoomMeeting, deleteZoomMeeting, zoomConfigured, zoomJoinDetails, type JoinDetails } from "@/lib/zoom";

const OFF_FOR_HER = "Video calls are off for her team. A site admin turns them on for the team, and the head coach for mentors (the Switchboard).";
const OFF_FOR_ONE = "Video calls are off for one of these players' teams. A site admin turns them on for a team, and the head coach for mentors (the Switchboard).";

export async function scheduleVideoCall(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) return failed("Your session has ended. Sign in again.");
    // one player, or several on one team for a group call (user, 2026-11-14)
    const playerIds = [...new Set(fd.getAll("player_id").filter((v): v is string => typeof v === "string" && isUuid(v)))];
    if (!playerIds.length) return invalid("player_id", "Pick who the call is with.");
    if (playerIds.length > CALL_MAX_PLAYERS) return invalid("player_id", `A call can have up to ${CALL_MAX_PLAYERS} players.`);
    const clean = cleanCallInput({ startsAt: fd.get("starts_at"), minutes: fd.get("minutes"), topic: fd.get("topic") });
    // the form's day-and-time box is "when"; the browser turns it into starts_at
    if (!clean.ok) return invalid(clean.field === "starts_at" ? "when" : clean.field, clean.error);

    // who's calling: a head coach, on the team they picked, or the players' mentor, on their team
    const coach = user.staff && isHeadCoach(user.staff.role) ? user.staff : null;
    const mentor = coach ? null : await getMentor();
    if (!coach && !mentor) return failed("Only mentors and head coaches can schedule video calls.");
    const supabase = await createClient();
    const teams = await Promise.all(playerIds.map((id) => supabase.rpc("video_call_team", { p_player_id: id })));
    const refused = teams.find((t) => t.error);
    if (refused?.error) return failed(refused.error.code === "42501" ? "You can only schedule calls with your own players." : "Couldn't check that. Try again.");
    if (teams.some((t) => !t.data)) return failed(playerIds.length > 1 ? OFF_FOR_ONE : OFF_FOR_HER);
    const formTeam = text(fd, "team_id");
    const teamId = coach && isUuid(formTeam) ? formTeam : teams[0].data!;
    if (!coach && new Set(teams.map((t) => t.data)).size > 1) return invalid("player_id", "A group call is for players on one team. Pick players from one team.");
    if (!zoomConfigured()) return failed(ZOOM_NOT_CONNECTED);
    // each booking is a call to Zoom: at most 4 an hour per person (user, 2026-11-13; the database limits the bookings too)
    const { data: allowed } = await supabase.rpc("rate_limit_hit", { p_bucket: "zoom.book", p_max: 4, p_window_seconds: 3600 });
    if (!allowed) return failed("You can book up to 4 video calls an hour. Try again later.");

    const meeting = await createZoomMeeting({ startsAt: clean.call.startsAt, minutes: clean.call.minutes });
    if (!meeting.ok) return failed(meeting.error);
    // the call and its invites in one step (book_video_call checks every player again)
    const { error: saveError } = await supabase.rpc("book_video_call", {
      p_team_id: teamId,
      p_player_ids: playerIds,
      p_host_name: (coach?.displayName ?? mentor?.displayName ?? "").slice(0, 80),
      p_topic: clean.call.topic,
      p_starts_at: clean.call.startsAt,
      p_minutes: clean.call.minutes,
      p_zoom_meeting_id: meeting.value,
      // which calendars show it (user, 2026-11-14); the booker's own always does
      p_calendars: callCalendars(fd.getAll("calendars"), coach ? "coach" : "mentor"),
    });
    if (saveError) {
      // nothing was booked here, so take it off Zoom too
      await deleteZoomMeeting(meeting.value);
      if (saveError.code === "P0008") return invalid("when", "Another video call is booked then. Pick another time.");
      if (saveError.code === "P0007") return invalid("when", "Pick a time that's still ahead.");
      if (saveError.code === "P0009") return failed("You can book up to 4 video calls an hour. Try again later.");
      if (saveError.code === "22023") return invalid("player_id", `Pick 1 to ${CALL_MAX_PLAYERS} players.`);
      if (saveError.code === "42501") return failed(playerIds.length > 1 ? OFF_FOR_ONE : OFF_FOR_HER);
      return failed(friendlyDbError(saveError));
    }
    refresh();
  });
}

/** The host or a head coach calls it off. The record stays; Zoom's meeting goes. */
export async function cancelVideoCall(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) return failed("Your session has ended. Sign in again.");
    const callId = text(fd, "call_id");
    if (!isUuid(callId)) return failed(STALE);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("video_calls")
      .update({ cancelled_at: new Date().toISOString(), cancelled_by: user.id })
      .eq("id", callId)
      .is("cancelled_at", null)
      .select("zoom_meeting_id");
    if (error) return failed(friendlyDbError(error));
    if (!data?.length) return failed("Only the person who scheduled it or a head coach can cancel this call.");
    if (zoomConfigured()) await deleteZoomMeeting(data[0].zoom_meeting_id);
    refresh();
  });
}

export type JoinResult = { error: string } | { join: JoinDetails & { userName: string; host: boolean } };

/** Everything the call page needs to put this person in the call, if they may join it now. */
export async function joinVideoCall(callId: string): Promise<JoinResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Sign in again." };
  if (!isUuid(callId)) return { error: "That call doesn't exist." };
  const supabase = await createClient();
  const { data: role, error } = await supabase.rpc("video_call_role", { p_call_id: callId });
  if (error || !role) return { error: "This call isn't one you can join." };
  if (role === "cancelled") return { error: "This call was cancelled." };
  if (role === "off") return { error: "Video calls are turned off for her team right now." };
  const { data: call } = await supabase
    .from("video_calls")
    .select("player_id, host_name, starts_at, minutes, cancelled_at, zoom_meeting_id")
    .eq("id", callId)
    .maybeSingle();
  if (!call) return { error: "This call isn't one you can join." };
  const state = callState(call);
  if (state === "upcoming") return { error: "The call opens 10 minutes before it starts." };
  if (state === "over") return { error: "This call is over." };
  if (!zoomConfigured()) return { error: ZOOM_NOT_CONNECTED };
  // each join asks Zoom for the meeting (and the host's key): at most 30 every 10 minutes per person
  const { data: allowed } = await supabase.rpc("rate_limit_hit", { p_bucket: "zoom.join", p_max: 30, p_window_seconds: 600 });
  if (!allowed) return { error: "That's a lot of tries in a short time. Wait a few minutes and join again." };

  const host = role === "host";
  const details = await zoomJoinDetails(call.zoom_meeting_id, host);
  if (!details.ok) return { error: details.error };
  return { join: { ...details.value, userName: host ? call.host_name : await guestName(user, callId), host } };
}

/** How a guest shows in the call: her own name, "Name (parent)" or "Name (coach)". */
async function guestName(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, callId: string): Promise<string> {
  if (user.staff) return `${user.staff.displayName} (coach)`;
  const supabase = await createClient();
  // her own invite on this call (a player reads only her own; a group call has several)
  const [mine, { data: invites }] = await Promise.all([getMyPlayerIds(), supabase.from("video_call_players").select("player_id").eq("call_id", callId)]);
  const playerId = (invites ?? []).map((r) => r.player_id).find((id) => mine.includes(id));
  if (playerId) {
    const { data } = await supabase.from("players").select("first_name, preferred_name, last_name").eq("id", playerId).maybeSingle();
    if (data) return playerName(data);
  }
  const { data: parent } = await supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle();
  return parent?.display_name ? `${parent.display_name} (parent)` : "Guest";
}
