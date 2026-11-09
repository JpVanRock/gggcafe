import type { Metadata } from "next";
import Link from "next/link";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import { ProgressBar } from "@/components/progress-bar";
import { CHAPTER_COUNT } from "@/lib/scorebook";
import { GAMES, GAME_COUNT, GAME_PLAYS, LEAGUE, gameStatuses, type GameStatus } from "@/lib/scorebook-game";
import { loadIq } from "../../../../data";
import { loadPlayer } from "../../../../section-data";
import { chapterHref } from "../../../../scorebook";

export const metadata: Metadata = { title: "Keep the Book: Games · Softball IQ · GGG.Cafe" };

function statusLine(g: GameStatus) {
  switch (g.status) {
    case "clean":
      return `Clean book ✓${g.best !== null ? ` · best ${g.best}/${GAME_PLAYS} first try` : ""}`;
    case "playing":
      return `In progress · batter ${g.batter} of ${GAME_PLAYS}`;
    case "open":
      return g.best !== null ? `Best ${g.best}/${GAME_PLAYS} first try · play it again` : "Ready";
    case "locked":
      return `Opens after a clean book in game ${g.n - 1}`;
  }
}

export default async function ScorebookGamesPage({ params }: PageProps<"/players/[playerId]/iq/scorebook/game">) {
  const { playerId } = await params;
  const supabase = await createClient();
  await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const iq = await loadIq(supabase, player.id);
  const done = iq.managerAwards.length;
  const header = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">How to Keep the Book · Extra credit</p>
          <h2 className="mt-1 font-display text-3xl font-bold tracking-wide text-highlight uppercase">Keep the book for real games</h2>
        </div>
        <Link href={`/players/${player.id}/iq`} className="text-sm text-pink hover:underline">
          ← Softball IQ
        </Link>
      </div>
    </>
  );

  if (done < CHAPTER_COUNT) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900 p-4 sm:p-6">
        {header}
        <EmptyState>
          Finish all six chapters to unlock the games ({done} of {CHAPTER_COUNT} done).{" "}
          <Link href={chapterHref(player.id, Math.min(done + 1, CHAPTER_COUNT))} className="text-pink hover:underline">
            Go to Chapter {Math.min(done + 1, CHAPTER_COUNT)} →
          </Link>
        </EmptyState>
      </div>
    );
  }

  const statuses = gameStatuses(iq.gameRuns);
  const clean = statuses.filter((g) => g.status === "clean").length;
  const found = new Set(iq.hiddenAwards.map((a) => a.award));
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-navy-700 bg-navy-900 p-4 sm:p-6">
      {header}
      <p className="text-sm text-muted">
        {GAME_COUNT} games, two innings and {GAME_PLAYS} batters each. You keep the book: every batter&apos;s box and every runner&apos;s. A clean
        book takes 12 of {GAME_PLAYS} right on the first try and the right line score, and opens the next game.
      </p>
      <ProgressBar value={clean} max={GAME_COUNT} label={`${clean} of ${GAME_COUNT} clean books`} />
      <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">
        {!found.has("world-series")
          ? "A clean book unlocks something. That's all we're saying."
          : !found.has("all-ten")
            ? `Clean books in all ${GAME_COUNT}? Something else is waiting.`
            : "You've found everything these games were hiding."}
      </p>
      <ol className="grid gap-2 md:grid-cols-2">
        {GAMES.map((game) => {
          const g = statuses[game.n - 1];
          const inner = (
            <>
              <span className="w-10 shrink-0 font-display text-2xl font-bold text-highlight tabular-nums">{String(game.n).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">
                  {LEAGUE[game.visitors].name} at {LEAGUE[game.home].name}
                </span>
                <span className={`block font-mono text-[11px] tracking-wider uppercase ${g.status === "clean" ? "text-highlight" : "text-muted"}`}>
                  {statusLine(g)}
                </span>
              </span>
              {g.status !== "locked" && <span className="text-sm text-pink">→</span>}
            </>
          );
          return (
            <li key={game.n}>
              {g.status === "locked" ? (
                <div className="flex items-center gap-3 rounded-lg border border-navy-700 px-3 py-2.5 opacity-50">{inner}</div>
              ) : (
                <Link
                  href={`/players/${player.id}/iq/scorebook/game/${game.n}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition hover:border-pink hover:bg-navy-800 ${
                    g.status === "clean" ? "border-neon/50" : "border-navy-600"
                  }`}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
