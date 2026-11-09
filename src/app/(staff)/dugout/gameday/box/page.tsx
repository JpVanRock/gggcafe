import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Loading } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import { loadOwnTeams } from "../../data";
import { TeamPicker, pickTeam } from "../../team-picker";
import { GamedayNav } from "../nav";

export const metadata: Metadata = { title: "Box Scores · GameDay · GGG.Cafe" };

export default function BoxScoresPage({ searchParams }: PageProps<"/dugout/gameday/box">) {
  return (
    <Suspense fallback={<Loading />}>
      <BoxScores searchParams={searchParams} />
    </Suspense>
  );
}

type GameRow = {
  id: string;
  game_date: string;
  home_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  event_name: string | null;
  home: { name: string } | null;
  away: { name: string } | null;
  lines: { team_id: string }[];
};

async function BoxScores({ searchParams }: Pick<PageProps<"/dugout/gameday/box">, "searchParams">) {
  await requireHeadCoachPage();
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const teams = await loadOwnTeams(supabase);
  if (teams.length === 0) return <EmptyState>Add your team on the Teams page first.</EmptyState>;
  const team = pickTeam(teams, teamParam);
  const today = todayISO();
  const { data } = await supabase
    .from("games")
    .select("id, game_date, home_team_id, home_score, away_score, status, event_name, home:teams!home_team_id(name), away:teams!away_team_id(name), lines:batting_lines(team_id)")
    .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
    .neq("status", "cancelled")
    .lte("game_date", today)
    .order("game_date", { ascending: false })
    .limit(60);
  const games = (data ?? []) as GameRow[];

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/gameday/box" />
      <GamedayNav current="box" teamId={team.id} />
      <div>
        <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">Box scores</h2>
        <p className="mt-1 text-sm text-muted">
          Enter each game&apos;s batting, pitching and fielding lines, with an optional 0-5 grade on every at-bat. Box scores feed season stats, GameDay
          player cards and each player&apos;s stats card.
        </p>
      </div>
      {games.length === 0 ? (
        <EmptyState>No games played yet. Games come from the team schedule.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {games.map((g) => {
            const home = g.home_team_id === team.id;
            const opponent = (home ? g.away?.name : g.home?.name) ?? "TBD";
            const us = home ? g.home_score : g.away_score;
            const them = home ? g.away_score : g.home_score;
            const entered = g.lines.some((l) => l.team_id === team.id);
            return (
              <li key={g.id}>
                <Link
                  href={`/dugout/gameday/box/${g.id}?team=${team.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-700 bg-navy-900/70 p-4 transition hover:border-pink hover:bg-navy-800"
                >
                  <span>
                    <span className="block font-semibold text-ink">
                      {home ? "vs" : "@"} {opponent}
                    </span>
                    <span className="text-sm text-muted">{[formatDay(g.game_date), g.event_name].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {us !== null && them !== null && (
                      <span className="font-display text-lg font-bold text-highlight tabular-nums">
                        {us}-{them}
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${
                        entered ? "bg-neon text-on-accent" : "border border-pink text-pink-soft"
                      }`}
                    >
                      {entered ? "Entered" : "Enter box score"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
