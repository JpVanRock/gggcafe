import "server-only";
// What's waiting on a coach, for the top of the dashboard (design audit 2026-11-18, P1): approvals,
// each linking to the tab where it's decided (player claims, coach sign-ups and parental consents on
// Roster; parents asking to join on Parents; mentors on Mentors), players who still owe fees, the next
// game's lineup and lineups left in draft. Also the counts the Dugout tiles carry.
import type { createClient } from "@/lib/supabase/server";
import type { StaffRequestRow } from "@/lib/approvals";
import { playerBalances, money, toCents } from "@/lib/budget";
import { loadRoster, currentSeason } from "@/lib/roster";
import { addDays, formatDay, formatTime, todayISO } from "@/lib/dates";
import { loadOwnTeams } from "../dugout/data";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Need = { key: string; text: string; href: string; action: string };
export type TileCounts = Record<string, number>;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type Waiting = { team_id: string; team_name: string; player_claims: number; parent_requests: number };

/** Approvals, by where they're decided. */
export async function loadApprovalNeeds(
  supabase: Supabase,
  { editor, head, staffRequests }: { editor: boolean; head: boolean; staffRequests: StaffRequestRow[] },
): Promise<{ needs: Need[]; counts: TileCounts }> {
  if (!editor) return { needs: [], counts: {} };
  const [{ data: waitingData }, { data: mentorData }, { data: consentData }] = await Promise.all([
    supabase.rpc("pending_approvals"),
    head ? supabase.rpc("mentor_requests_waiting") : Promise.resolve({ data: 0 }),
    supabase.rpc("pending_parental_consents"),
  ]);
  const waiting = (waitingData ?? []) as Waiting[];
  const mentors = Number(mentorData ?? 0);
  const consents = ((consentData ?? []) as unknown[]).length;
  const heads = staffRequests.filter((r) => r.role === "coach");
  const assistants = staffRequests.filter((r) => r.role === "assistant");
  const needs: Need[] = [];
  const many = waiting.length > 1;
  const on = (name: string) => (many ? `${name}: ` : "");

  if (heads.length) needs.push({ key: "heads", text: `${plural(heads.length, "head coach", "head coaches")} asking to join: ${heads.map((r) => r.display_name).join(", ")}`, href: "/dugout/roster#waiting", action: "Review" });
  if (consents) needs.push({ key: "consents", text: `${plural(consents, "parental consent")} to check`, href: "/dugout/roster#waiting", action: "Review" });
  for (const w of waiting) {
    const claims = Number(w.player_claims);
    const parents = Number(w.parent_requests);
    const coaches = assistants.filter((r) => r.team_id === w.team_id).length;
    const roster = [claims && plural(claims, "player claim"), coaches && plural(coaches, "assistant coach", "assistant coaches")].filter(Boolean);
    if (roster.length) needs.push({ key: `roster-${w.team_id}`, text: `${on(w.team_name)}${roster.join(" · ")} to approve`, href: `/dugout/roster?team=${w.team_id}#waiting`, action: "Review" });
    if (parents) needs.push({ key: `parents-${w.team_id}`, text: `${on(w.team_name)}${plural(parents, "parent")} asking to join`, href: `/dugout/parents?team=${w.team_id}`, action: "Review" });
  }
  // assistant coaches for a team with nothing else waiting
  const listed = new Set(waiting.map((w) => w.team_id));
  const rest = new Map<string, StaffRequestRow[]>();
  for (const r of assistants) if (!listed.has(r.team_id ?? "")) rest.set(r.team_id ?? "", [...(rest.get(r.team_id ?? "") ?? []), r]);
  for (const [teamId, rows] of rest)
    needs.push({ key: `assistants-${teamId}`, text: `${rows[0].team_name ? `${rows[0].team_name}: ` : ""}${plural(rows.length, "assistant coach", "assistant coaches")} to approve`, href: `/dugout/roster${teamId ? `?team=${teamId}` : ""}#waiting`, action: "Review" });
  if (mentors) needs.push({ key: "mentors", text: `${plural(mentors, "mentor")} asking to work with the team`, href: "/dugout/mentors", action: "Review" });

  const parentRequests = waiting.reduce((n, w) => n + Number(w.parent_requests), 0);
  const rosterCount = waiting.reduce((n, w) => n + Number(w.player_claims), 0) + staffRequests.length + consents;
  return { needs, counts: { "/dugout/roster": rosterCount, "/dugout/parents": parentRequests, "/dugout/mentors": mentors } };
}

type GameRow = { id: string; game_date: string; start_time: string | null; home_team_id: string; home: { name: string } | null; away: { name: string } | null };
type LineupRow = { id: string; team_id: string; game_id: string | null; game_date: string; opponent: string | null; status: "draft" | "final" };

/** Fees still owed, the next game's lineup and lineups left in draft, for the coach's own teams. */
export async function loadTeamNeeds(supabase: Supabase): Promise<Need[]> {
  const teams = await loadOwnTeams(supabase);
  const today = todayISO();
  const perTeam = await Promise.all(
    teams.map(async (team) => {
      const seasonId = await currentSeason(supabase, team.id);
      const [roster, fees, adjustments, payments, games, lineups] = await Promise.all([
        seasonId ? loadRoster(supabase, team.id, { seasonId }) : Promise.resolve([]),
        seasonId ? supabase.from("budget_fees").select("amount").eq("team_id", team.id).eq("season_id", seasonId) : Promise.resolve({ data: [] }),
        seasonId ? supabase.from("budget_adjustments").select("player_id, amount").eq("team_id", team.id).eq("season_id", seasonId) : Promise.resolve({ data: [] }),
        seasonId
          ? supabase.from("budget_entries").select("player_id, amount, category").eq("team_id", team.id).eq("season_id", seasonId).eq("kind", "payment")
          : Promise.resolve({ data: [] }),
        supabase
          .from("games")
          .select("id, game_date, start_time, home_team_id, home:teams!home_team_id(name), away:teams!away_team_id(name)")
          .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
          .gte("game_date", today)
          .lte("game_date", addDays(today, 14))
          .order("game_date")
          .order("start_time", { nullsFirst: true })
          .limit(1),
        supabase.from("gameday_lineups").select("id, team_id, game_id, game_date, opponent, status").eq("team_id", team.id).gte("game_date", today).order("game_date"),
      ]);
      const needs: Need[] = [];
      const on = teams.length > 1 ? `${team.name}: ` : "";

      const feeCents = ((fees.data ?? []) as { amount: number }[]).reduce((sum, f) => sum + toCents(f.amount), 0);
      if (feeCents > 0 && roster.length) {
        const balances = playerBalances(
          roster.map((p) => p.id),
          feeCents,
          new Map(((adjustments.data ?? []) as { player_id: string; amount: number }[]).map((a) => [a.player_id, toCents(a.amount)])),
          ((payments.data ?? []) as { player_id: string | null; amount: number; category: string | null }[]).map((p) => ({ player_id: p.player_id, cents: toCents(p.amount), category: p.category })),
        );
        const owing = balances.filter((b) => b.owed > 0);
        if (owing.length)
          needs.push({
            key: `fees-${team.id}`,
            text: `${on}${plural(owing.length, "player")} still ${owing.length === 1 ? "owes" : "owe"} fees (${money(owing.reduce((sum, b) => sum + b.owed, 0))})`,
            href: `/dugout/budget?team=${team.id}`,
            action: "Open the budget",
          });
      }

      const game = ((games.data ?? []) as GameRow[])[0];
      const drafts = ((lineups.data ?? []) as LineupRow[]).filter((l) => l.status === "draft");
      if (game) {
        const opponent = game.home_team_id === team.id ? game.away?.name : game.home?.name;
        const when = `${game.game_date === today ? "today" : game.game_date === addDays(today, 1) ? "tomorrow" : formatDay(game.game_date)}${game.start_time ? ` at ${formatTime(game.start_time)}` : ""}`;
        const lineup = ((lineups.data ?? []) as LineupRow[]).find((l) => l.game_id === game.id) ?? ((lineups.data ?? []) as LineupRow[]).find((l) => l.game_date === game.game_date);
        if (!lineup)
          needs.push({ key: `game-${game.id}`, text: `${on}Next game ${when}${opponent ? ` vs ${opponent}` : ""}: no lineup yet`, href: `/dugout/gameday?team=${team.id}`, action: "Build the lineup" });
        else if (lineup.status === "draft")
          needs.push({ key: `game-${game.id}`, text: `${on}Next game ${when}${opponent ? ` vs ${opponent}` : ""}: the lineup is still a draft`, href: `/dugout/gameday/${lineup.id}`, action: "Finish it" });
        const others = drafts.filter((d) => d.id !== lineup?.id);
        if (others.length) needs.push({ key: `drafts-${team.id}`, text: `${on}${plural(others.length, "more lineup")} still in draft`, href: `/dugout/gameday?team=${team.id}`, action: "Open GameDay" });
      } else if (drafts.length) {
        needs.push({ key: `drafts-${team.id}`, text: `${on}${plural(drafts.length, "lineup")} still in draft`, href: `/dugout/gameday?team=${team.id}`, action: "Open GameDay" });
      }
      return needs;
    }),
  );
  return perTeam.flat();
}

/** The head coach's first steps, and whether each is done; the card goes once the first three are. */
export async function loadGetStarted(supabase: Supabase) {
  const teams = await loadOwnTeams(supabase);
  const [rosters, codes] = await Promise.all([
    Promise.all(teams.map((t) => loadRoster(supabase, t.id))),
    teams.length ? supabase.from("team_parent_codes").select("team_id").in("team_id", teams.map((t) => t.id)) : Promise.resolve({ data: [] }),
  ]);
  return {
    team: teams.length > 0,
    roster: rosters.some((r) => r.length > 0),
    code: ((codes.data ?? []) as unknown[]).length > 0,
  };
}
