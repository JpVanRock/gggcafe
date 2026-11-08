import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Loading } from "@/components/ui";
import { CHAPTER_COUNT } from "@/lib/scorebook";
import type { BoxMarks } from "@/lib/scorebook";
import { loadIq } from "../../../../data";
import { loadPlayer } from "../../../../section-data";
import { chapterHref } from "../../../../scorebook";
import { GameRunner } from "../../../../scorebook-game-client";

export const metadata: Metadata = { title: "Keep the Book: Game · Softball IQ · GGG.Cafe" };

export default function ScorebookGamePage({ params }: PageProps<"/players/[playerId]/iq/scorebook/game">) {
  return (
    <Suspense fallback={<Loading />}>
      <Game params={params} />
    </Suspense>
  );
}

async function Game({ params }: Pick<PageProps<"/players/[playerId]/iq/scorebook/game">, "params">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const [iq, { data: open }] = await Promise.all([
    loadIq(supabase, player.id),
    supabase
      .from("scorebook_game_runs")
      .select("id, next_play, first_try, tries, book")
      .eq("player_id", player.id)
      .is("finished_at", null)
      .maybeSingle(),
  ]);
  const done = iq.managerAwards.length;
  const iqHref = `/players/${player.id}/iq`;

  return (
    <div className="rounded-2xl border border-navy-700 bg-navy-900 p-4 sm:p-6">
      {done < CHAPTER_COUNT ? (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">How to Keep the Book · Extra credit</p>
          <h2 className="font-display text-3xl font-bold tracking-wide text-highlight uppercase">Keep the book for a real game</h2>
          <EmptyState>
            Finish all six chapters to unlock it ({done} of {CHAPTER_COUNT} done).{" "}
            <Link href={chapterHref(player.id, Math.min(done + 1, CHAPTER_COUNT))} className="text-pink hover:underline">
              Go to Chapter {Math.min(done + 1, CHAPTER_COUNT)} →
            </Link>
          </EmptyState>
        </div>
      ) : (
        <GameRunner
          playerId={player.id}
          initialRun={
            open
              ? {
                  id: open.id as string,
                  nextPlay: open.next_play as number,
                  firstTry: open.first_try as number,
                  tries: open.tries as number,
                  book: (open.book ?? {}) as Record<string, BoxMarks>,
                }
              : null
          }
          canEdit={access.canAct}
          won={iq.hiddenAwards.some((a) => a.award === "world-series")}
          iqHref={iqHref}
          trophiesHref={`/players/${player.id}/trophies`}
        />
      )}
    </div>
  );
}
