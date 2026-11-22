import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getMyPlayerIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE } from "@/lib/dates";
import { isUuid, playerName } from "@/lib/softball";
import { CALL_STATE_LABEL, OPENS_EARLY_MINUTES, callState, formatCallClock, formatCallDay, formatCallTime } from "@/lib/video-calls";
import { Badge, Eyebrow } from "@/components/ui";
import { CallRoom } from "./call-room";

export const metadata: Metadata = { title: "Video call · GGG.Cafe" };

// A video call (user, 2026-11-12; docs/features/video-calls.md), held here on Zoom: the mentor or
// head coach who booked it hosts; she, her parents, head coaches and any mentors a head coach invited (user,
// 2026-11-22) join. Anyone else gets a 404.
export default async function CallPage({ params }: PageProps<"/calls/[callId]">) {
  const { callId } = await params;
  if (!isUuid(callId)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const [{ data: call }, { data: role }, myPlayers, { data: invites }, { data: mentorRows }] = await Promise.all([
    supabase
      .from("video_calls")
      .select("id, team_id, player_id, host_kind, host_name, topic, starts_at, minutes, cancelled_at, group_size, player:players(first_name, preferred_name, last_name)")
      .eq("id", callId)
      .maybeSingle(),
    supabase.rpc("video_call_role", { p_call_id: callId }),
    getMyPlayerIds(),
    // her own invite (a player or parent reads only their own; a group call has several players)
    supabase.from("video_call_players").select("player_id").eq("call_id", callId),
    // mentors a head coach invited (everyone who can join reads them)
    supabase.from("video_call_mentors").select("mentor_id, mentor_name").eq("call_id", callId).order("mentor_name"),
  ]);
  if (!call) notFound();
  const state = callState(call);
  const group = call.group_size > 1;
  const myInvite = (invites ?? []).map((r) => r.player_id).find((id) => myPlayers.includes(id));
  const her = group ? `A group of ${call.group_size} players` : call.player ? playerName(call.player) : "her";
  const hostLabel = call.host_kind === "mentor" ? "mentor" : "head coach";
  const mentors = mentorRows ?? [];
  const invitedMentor = mentors.some((m) => m.mentor_id === user.id);
  // back to where this person keeps their calls
  const back = user.staff
    ? { href: `/dugout/calendar?team=${call.team_id}`, label: "Calendar" }
    : role === "host" || invitedMentor
      ? group || invitedMentor
        ? { href: "/mentor", label: "Mentor home" }
        : { href: `/mentor/players/${call.player_id}`, label: her }
      : myInvite
        ? { href: `/players/${myInvite}`, label: "My dashboard" }
        : { href: "/family", label: "Family home" };
  const opens = new Date(new Date(call.starts_at).getTime() - OPENS_EARLY_MINUTES * 60_000).toISOString();

  return (
    <div className="flex flex-col gap-6">
      <Link href={back.href} className="self-start text-sm text-muted hover:text-ink">
        ← {back.label}
      </Link>
      <header className="flex flex-col gap-2">
        <Eyebrow>Video call · {formatCallTime(call.starts_at, APP_TIME_ZONE)} · {call.minutes} min</Eyebrow>
        <h1 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase sm:text-4xl">{call.topic}</h1>
        <p className="text-sm text-muted">
          {her} with {call.host_name} ({hostLabel})
          {mentors.length > 0 && ` and ${mentors.map((m) => `${m.mentor_name} (mentor)`).join(", ")}`}. <Badge tone={state === "open" ? "neon" : "neutral"}>{CALL_STATE_LABEL[state]}</Badge>
        </p>
      </header>

      {role === "cancelled" || state === "cancelled" ? (
        <p className="rounded-xl border border-navy-700 px-4 py-3 text-sm">This call was cancelled.</p>
      ) : role === "off" ? (
        <p className="rounded-xl border border-navy-700 px-4 py-3 text-sm">Video calls are turned off for her team right now, so this call can&apos;t go ahead.</p>
      ) : role !== "host" && role !== "guest" ? (
        <p className="rounded-xl border border-navy-700 px-4 py-3 text-sm">
          {group
            ? "Only the host, the invited players and their parents, invited mentors and head coaches can join this call."
            : `Only the host, ${her}, her parents, invited mentors and head coaches can join this call.`}
        </p>
      ) : state === "upcoming" ? (
        <p className="rounded-xl border border-navy-700 px-4 py-3 text-sm">
          The call opens at {formatCallClock(opens, APP_TIME_ZONE)} on {formatCallDay(opens, APP_TIME_ZONE)}, {OPENS_EARLY_MINUTES} minutes before it starts.
          Come back then.
        </p>
      ) : state === "over" ? (
        <p className="rounded-xl border border-navy-700 px-4 py-3 text-sm">This call is over.</p>
      ) : (
        <CallRoom callId={call.id} host={role === "host"} />
      )}

      <ul className="flex flex-col gap-1 text-xs text-muted">
        <li>Calls aren&apos;t recorded, here or on Zoom.</li>
        <li>{group ? "Every invited player's parents are invited and can join it" : "Her parents are invited to every call and can join it"}; head coaches can drop in.</li>
        <li>Everyone waits in the waiting room until the host lets them in.</li>
      </ul>
    </div>
  );
}
