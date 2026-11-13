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
import { callState, cleanCallInput } from "@/lib/video-calls";
import { ZOOM_NOT_CONNECTED, createZoomMeeting, deleteZoomMeeting, zoomConfigured, zoomJoinDetails, type JoinDetails } from "@/lib/zoom";

const OFF_FOR_HER = "Video calls are off for her team. A site admin turns them on for the team, and the head coach for mentors (the Switchboard).";

export async function scheduleVideoCall(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) return failed("Your session has ended. Sign in again.");
    const playerId = text(fd, "player_id");
    if (!isUuid(playerId)) return invalid("player_id", "Pick who the call is with.");
    const clean = cleanCallInput({ startsAt: fd.get("starts_at"), minutes: fd.get("minutes"), topic: fd.get("topic") });
    // the form's day-and-time box is "when"; the browser turns it into starts_at
    if (!clean.ok) return invalid(clean.field === "starts_at" ? "when" : clean.field, clean.error);

    // who's calling: a head coach, on the team they picked, or one of her mentors, on her team
    const coach = user.staff && isHeadCoach(user.staff.role) ? user.staff : null;
    const mentor = coach ? null : await getMentor();
    if (!coach && !mentor) return failed("Only mentors and head coaches can schedule video calls.");
    const supabase = await createClient();
    const { data: herTeam, error } = await supabase.rpc("video_call_team", { p_player_id: playerId });
    if (error) return failed(error.code === "42501" ? "You can only schedule calls with your own players." : "Couldn't check that. Try again.");
    if (!herTeam) return failed(OFF_FOR_HER);
    const teamId = coach ? text(fd, "team_id") : herTeam;
    if (!isUuid(teamId)) return failed(STALE);
    if (!zoomConfigured()) return failed(ZOOM_NOT_CONNECTED);
    // each booking is a call to Zoom: at most 12 an hour per person (and the database limits the bookings too)
    const { data: allowed } = await supabase.rpc("rate_limit_hit", { p_bucket: "zoom.book", p_max: 12, p_window_seconds: 3600 });
    if (!allowed) return failed("That's a lot of bookings in a short time. Wait a few minutes and try again.");

    const meeting = await createZoomMeeting({ startsAt: clean.call.startsAt, minutes: clean.call.minutes });
    if (!meeting.ok) return failed(meeting.error);
    const { error: saveError } = await supabase.from("video_calls").insert({
      team_id: teamId,
      player_id: playerId,
      host_kind: coach ? "coach" : "mentor",
      host_name: (coach?.displayName ?? mentor?.displayName ?? "").slice(0, 80),
      topic: clean.call.topic,
      starts_at: clean.call.startsAt,
      minutes: clean.call.minutes,
      zoom_meeting_id: meeting.value,
    });
    if (saveError) {
      // nothing was booked here, so take it off Zoom too
      await deleteZoomMeeting(meeting.value);
      if (saveError.code === "P0008") return invalid("when", "Another video call is booked then. Pick another time.");
      if (saveError.code === "P0007") return invalid("when", "Pick a time that's still ahead.");
      if (saveError.code === "42501") return failed(OFF_FOR_HER);
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
  return { join: { ...details.value, userName: host ? call.host_name : await guestName(user, call.player_id), host } };
}

/** How a guest shows in the call: her own name, "Name (parent)" or "Name (coach)". */
async function guestName(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, playerId: string): Promise<string> {
  if (user.staff) return `${user.staff.displayName} (coach)`;
  const supabase = await createClient();
  if ((await getMyPlayerIds()).includes(playerId)) {
    const { data } = await supabase.from("players").select("first_name, preferred_name, last_name").eq("id", playerId).maybeSingle();
    if (data) return playerName(data);
  }
  const { data: parent } = await supabase.from("parent_accounts").select("display_name").eq("user_id", user.id).maybeSingle();
  return parent?.display_name ? `${parent.display_name} (parent)` : "Guest";
}
