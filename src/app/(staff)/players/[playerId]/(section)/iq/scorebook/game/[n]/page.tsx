import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Loading } from "@/components/ui";
import { CHAPTER_COUNT, type BoxMarks } from "@/lib/scorebook";
import { GAME_COUNT, gameStatuses } from "@/lib/scorebook-game";
import { loadIq } from "../../../../../data";
import { loadPlayer } from "../../../../../section-data";
import { GameRunner } from "../../../../../scorebook-game-client";

export const metadata: Metadata = { title: "Keep the Book: Game · Softball IQ · GGG.Cafe" };

export default function ScorebookGamePage({ params }: PageProps<"/players/[playerId]/iq/scorebook/game/[n]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Game params={params} />
    </Suspense>
  );
}

async function Game({ params }: Pick<PageProps<"/players/[playerId]/iq/scorebook/game/[n]">, "params">) {
  const { playerId, n: raw } = await params;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > GAME_COUNT) notFound();
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const [iq, { data: open }] = await Promise.all([
    loadIq(supabase, player.id),
    supabase
      .from("scorebook_game_runs")
      .select("id, game, next_play, first_try, tries, book")
      .eq("player_id", player.id)
      .eq("game", n)
      .is("finished_at", null)
      .maybeSingle(),
  ]);
  const gamesHref = `/players/${player.id}/iq/scorebook/game`;
  const status = gameStatuses(iq.gameRuns)[n - 1];
  const locked = iq.managerAwards.length < CHAPTER_COUNT || status.status === "locked";

  return (
    <div className="rounded-2xl border border-navy-700 bg-navy-900 p-4 sm:p-6">
      {locked ? (
        <EmptyState>
          {iq.managerAwards.length < CHAPTER_COUNT
            ? "Finish all six chapters to unlock the games."
            : `Game ${n} opens after a clean book in game ${n - 1}.`}{" "}
          <Link href={gamesHref} className="text-pink hover:underline">
            All games →
          </Link>
        </EmptyState>
      ) : (
        <GameRunner
          key={n}
          playerId={player.id}
          game={n}
          initialRun={
            open
              ? {
                  id: open.id as string,
                  game: open.game as number,
                  nextPlay: open.next_play as number,
                  firstTry: open.first_try as number,
                  tries: open.tries as number,
                  book: (open.book ?? {}) as Record<string, BoxMarks>,
                }
              : null
          }
          canEdit={access.canAct}
          found={{
            worldSeries: iq.hiddenAwards.some((a) => a.award === "world-series"),
            allTen: iq.hiddenAwards.some((a) => a.award === "all-ten"),
          }}
          gamesHref={gamesHref}
          nextHref={n < GAME_COUNT ? `${gamesHref}/${n + 1}` : null}
          trophiesHref={`/players/${player.id}/trophies`}
        />
      )}
    </div>
  );
}
