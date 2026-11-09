import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Loading } from "@/components/ui";
import { formatLongDate } from "@/lib/dates";
import { isUuid } from "@/lib/softball";
import { loadGamedayRoster } from "@/lib/gameday-data";
import { seasonOrCurrent } from "@/lib/roster";
import type { BoxScore } from "@/lib/box-score";
import { BoxScoreForm } from "./box-form";

export const metadata: Metadata = { title: "Box Score · GameDay · GGG.Cafe" };

export default function BoxScorePage({ params, searchParams }: PageProps<"/dugout/gameday/box/[gameId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Box params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type GameRow = {
  id: string;
  season_id: string | null;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  home: { id: string; name: string; is_own_team: boolean } | null;
  away: { id: string; name: string; is_own_team: boolean } | null;
};

async function Box({ params, searchParams }: Pick<PageProps<"/dugout/gameday/box/[gameId]">, "params" | "searchParams">) {
  await requireHeadCoachPage();
  const { gameId } = await params;
  const { team: teamParam } = await searchParams;
  if (!isUuid(gameId)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("id, season_id, game_date, home_team_id, away_team_id, home_score, away_score, home:teams!home_team_id(id, name, is_own_team), away:teams!away_team_id(id, name, is_own_team)")
    .eq("id", gameId)
    .maybeSingle();
  if (!data) notFound();
  const game = data as GameRow;
  const ours = [game.home, game.away].filter((t): t is NonNullable<typeof t> => Boolean(t?.is_own_team));
  const team = ours.find((t) => t.id === teamParam) ?? ours[0];
  if (!team) notFound();
  const home = team.id === game.home_team_id;
  const opponent = (home ? game.away?.name : game.home?.name) ?? "TBD";

  const seasonId = await seasonOrCurrent(supabase, team.id, game.season_id);
  const [roster, lineupResult, batting, pitching, fielding, grades] = await Promise.all([
    seasonId ? loadGamedayRoster(supabase, team.id, seasonId) : Promise.resolve([]),
    supabase.from("gameday_lineups").select("batting_order").eq("game_id", gameId).eq("team_id", team.id).order("updated_at", { ascending: false }).limit(1),
    supabase
      .from("batting_lines")
      .select("player_id, pa:plate_appearances, ab:at_bats, r:runs, h:hits, d:doubles, t:triples, hr:home_runs, rbi, bb:walks, so:strikeouts, hbp:hit_by_pitch, sac:sac_bunts, sf:sac_flies, sb:stolen_bases, cs:caught_stealing")
      .eq("game_id", gameId)
      .eq("team_id", team.id),
    supabase
      .from("pitching_lines")
      .select("player_id, starter:is_starter, outs:outs_recorded, bf:batters_faced, h:hits_allowed, r:runs_allowed, er:earned_runs, bb:walks, so:strikeouts, hbp:hit_batters, hr:home_runs_allowed, wp:wild_pitches, pitches, strikes, decision")
      .eq("game_id", gameId)
      .eq("team_id", team.id)
      .order("is_starter", { ascending: false }),
    supabase
      .from("fielding_lines")
      .select("player_id, po:putouts, a:assists, e:errors, dp:double_plays, pb:passed_balls, sba:stolen_bases_allowed, cs:runners_caught_stealing")
      .eq("game_id", gameId)
      .eq("team_id", team.id),
    supabase.from("pa_grades").select("player_id, pa_no, grade").eq("game_id", gameId).eq("team_id", team.id),
  ]);

  // Batting order from the game's lineup when there is one, then everyone else
  const order = ((lineupResult.data ?? [])[0] as { batting_order: string[] } | undefined)?.batting_order ?? [];
  const players = [...order.map((id) => roster.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p)), ...roster.filter((p) => !order.includes(p.id))].map(
    (p) => ({ id: p.id, short: p.short }),
  );
  const initial: BoxScore = {
    us: home ? game.home_score : game.away_score,
    them: home ? game.away_score : game.home_score,
    batting: (batting.data ?? []) as BoxScore["batting"],
    pitching: (pitching.data ?? []) as BoxScore["pitching"],
    fielding: (fielding.data ?? []) as BoxScore["fielding"],
    grades: (grades.data ?? []) as BoxScore["grades"],
  };

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dugout/gameday/box?team=${team.id}`} className="text-sm text-muted hover:text-ink">
        ← Box scores · {team.name}
      </Link>
      <header>
        <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{team.name} · Box score</p>
        <h2 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">
          {home ? "vs" : "@"} {opponent}
        </h2>
        <p className="mt-1 text-sm text-muted">{formatLongDate(game.game_date)}</p>
      </header>
      {players.length === 0 ? (
        <EmptyState>No roster for this season yet.</EmptyState>
      ) : (
        <BoxScoreForm gameId={game.id} teamId={team.id} players={players} initial={initial} />
      )}
    </div>
  );
}
