import "server-only";

// The video calls players are invited to (user, 2026-11-14: group calls). A call's player_id is only its
// first player; video_call_players lists everyone invited. Players and parents read only their own invite
// rows, so this finds their calls without revealing the other children on a group call.
import type { createClient } from "@/lib/supabase/server";
import { VIDEO_CALL_COLUMNS, type VideoCallRow } from "@/components/video-calls";

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
