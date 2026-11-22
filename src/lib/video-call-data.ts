import "server-only";

// The video calls players are invited to (user, 2026-11-14: group calls). A call's player_id is only its
// first player; video_call_players lists everyone invited. Players and parents read only their own invite
// rows, so this finds their calls without revealing the other children on a group call. Also a mentor's calls
// (the ones they host and the ones a head coach invited them to) and the mentors a head coach can invite.
import type { createClient } from "@/lib/supabase/server";
import { VIDEO_CALL_COLUMNS, type VideoCallRow } from "@/components/video-calls";
import type { CallMentor } from "@/lib/video-calls";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Calls any of these players is invited to, not cancelled, starting at or after `since` (and before `until`
 * when given), soonest first; with which of the players each one invites.
 */
export async function callsForPlayers(
  supabase: Supabase,
  playerIds: string[],
  { since, until, limit = 20 }: { since: string; until?: string; limit?: number },
): Promise<{ calls: VideoCallRow[]; invited: Map<string, string[]> }> {
  if (!playerIds.length) return { calls: [], invited: new Map() };
  const { data: invites } = await supabase.from("video_call_players").select("call_id, player_id").in("player_id", playerIds);
  const invited = new Map<string, string[]>();
  for (const row of invites ?? []) invited.set(row.call_id, [...(invited.get(row.call_id) ?? []), row.player_id]);
  if (!invited.size) return { calls: [], invited };
  let query = supabase
    .from("video_calls")
    .select(VIDEO_CALL_COLUMNS)
    .in("id", [...invited.keys()])
    .is("cancelled_at", null)
    .gte("starts_at", since);
  if (until) query = query.lte("starts_at", until);
  const { data } = await query.order("starts_at").limit(limit);
  return { calls: (data ?? []) as VideoCallRow[], invited };
}

/**
 * A mentor's calls, not cancelled, starting at or after `since` (and before `until` when given), soonest first: the
 * ones they host and the ones a head coach invited them to (user, 2026-11-22). `invitedTo` has the ids of the calls
 * they were invited to (they can't cancel those).
 */
export async function callsForMentor(
  supabase: Supabase,
  mentorId: string,
  { since, until, limit = 20 }: { since: string; until?: string; limit?: number },
): Promise<{ calls: VideoCallRow[]; invitedTo: Set<string> }> {
  const { data: invites } = await supabase.from("video_call_mentors").select("call_id").eq("mentor_id", mentorId);
  const invitedTo = new Set((invites ?? []).map((r) => r.call_id));
  let hosted = supabase.from("video_calls").select(VIDEO_CALL_COLUMNS).eq("host_id", mentorId).is("cancelled_at", null).gte("starts_at", since);
  let guest = supabase.from("video_calls").select(VIDEO_CALL_COLUMNS).in("id", [...invitedTo]).is("cancelled_at", null).gte("starts_at", since);
  if (until) {
    hosted = hosted.lte("starts_at", until);
    guest = guest.lte("starts_at", until);
  }
  const [{ data: own }, { data: invited }] = await Promise.all([
    hosted.order("starts_at").limit(limit),
    invitedTo.size ? guest.order("starts_at").limit(limit) : Promise.resolve({ data: [] }),
  ]);
  const calls = new Map([...((own ?? []) as VideoCallRow[]), ...((invited ?? []) as VideoCallRow[])].map((c) => [c.id, c]));
  return { calls: [...calls.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, limit), invitedTo };
}

/**
 * The mentors a head coach can invite to a call on this team (user, 2026-11-22): approved whole-team mentors of the
 * team, and the approved one-on-one mentors of players on `roster`, with the players each works with. `exclude` is
 * the head coach themself (a head coach can be a mentor too).
 */
export async function callMentorsForTeam(
  supabase: Supabase,
  teamId: string,
  roster: { id: string; name: string }[],
  exclude: string,
): Promise<CallMentor[]> {
  if (!roster.length) return [];
  const names = new Map(roster.map((p) => [p.id, p.name]));
  const { data: links } = await supabase
    .from("mentor_links")
    .select("mentor_id, team_id, player_id")
    .eq("status", "approved")
    .or(`team_id.eq.${teamId},player_id.in.(${roster.map((p) => p.id).join(",")})`);
  const whole = new Set<string>();
  const theirs = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    if (l.mentor_id === exclude) continue;
    if (!l.player_id && l.team_id === teamId) whole.add(l.mentor_id);
    else if (l.player_id && names.has(l.player_id)) theirs.set(l.mentor_id, (theirs.get(l.mentor_id) ?? new Set()).add(l.player_id));
  }
  const ids = [...new Set([...whole, ...theirs.keys()])];
  if (!ids.length) return [];
  const { data: mentors } = await supabase.from("mentors").select("user_id, display_name").in("user_id", ids);
  return (mentors ?? [])
    .map((m) => {
      const players = whole.has(m.user_id) ? null : [...(theirs.get(m.user_id) ?? [])];
      return { id: m.user_id, name: m.display_name, players, note: players ? players.map((id) => names.get(id)).join(", ") : "Whole team" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
