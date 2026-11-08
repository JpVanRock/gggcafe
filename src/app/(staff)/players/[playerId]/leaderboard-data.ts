// Offseason Training Leaderboard data. Teammates come only through the
// team_leaderboard() function (names, numbers, points), never their own rows.
import type { createClient } from "@/lib/supabase/server";
import type { LeaderboardData } from "@/lib/leaderboard";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The team's board (and decides any finished Player of the Week). Null if she can't see it. */
export async function loadLeaderboard(supabase: Supabase, teamId: string): Promise<LeaderboardData | null> {
  const { data, error } = await supabase.rpc("team_leaderboard", { p_team_id: teamId });
  if (error || !data) return null;
  const d = data as Partial<LeaderboardData>;
  return { offseason: d.offseason ?? null, today: d.today ?? "", week_start: d.week_start, players: d.players ?? [], weeks: d.weeks ?? [] };
}

export type LoggedSession = { id: string; kind: string; logged_on: string; note: string | null };

/** Her own logged sessions, newest first. */
export async function loadMySessions(supabase: Supabase, playerId: string, limit = 20): Promise<LoggedSession[]> {
  const { data } = await supabase
    .from("training_logs")
    .select("id, kind, logged_on, note")
    .eq("player_id", playerId)
    .order("logged_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as LoggedSession[];
}

/** Every session the team's players logged lately (coaches police the board). */
export async function loadTeamSessions(supabase: Supabase, playerIds: string[], since: string) {
  if (playerIds.length === 0) return [];
  const { data } = await supabase
    .from("training_logs")
    .select("id, player_id, kind, logged_on, note")
    .in("player_id", playerIds)
    .gte("logged_on", since)
    .order("logged_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as (LoggedSession & { player_id: string })[];
}
