import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Loading } from "@/components/ui";
import { CHAPTERS } from "@/lib/scorebook";
import { loadIq, loadPopReport } from "../../../../data";
import { loadPlayer, plateFor } from "../../../../section-data";
import { buildCourse, chapterHref } from "../../../../scorebook";
import { ChapterRunner } from "../../../../scorebook-client";

export const metadata: Metadata = { title: "How to Keep the Book · Softball IQ · GGG.Cafe" };

export default function ScorebookChapterPage({ params }: PageProps<"/players/[playerId]/iq/scorebook/[chapter]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Chapter params={params} />
    </Suspense>
  );
}

async function Chapter({ params }: Pick<PageProps<"/players/[playerId]/iq/scorebook/[chapter]">, "params">) {
  const { playerId, chapter: raw } = await params;
  const n = Number(raw);
  if (!CHAPTERS.some((c) => c.n === n)) notFound();
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const [iq, pop] = await Promise.all([loadIq(supabase, player.id), loadPopReport(supabase, player.id)]);
  const course = buildCourse(iq);
  const c = course.chapters.find((x) => x.n === n)!;
  const iqHref = `/players/${player.id}/iq`;

  return (
    <div className="rounded-2xl border border-navy-700 bg-navy-900 p-4 sm:p-6">
      {c.status === "locked" ? (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">How to Keep the Book · Chapter {n}</p>
          <h2 className="font-display text-3xl font-bold tracking-wide text-highlight uppercase">{c.title}</h2>
          <EmptyState>
            Chapter {n} opens once Chapter {n - 1} is complete.{" "}
            <Link href={chapterHref(player.id, n - 1)} className="text-pink hover:underline">
              Go to Chapter {n - 1} →
            </Link>
          </EmptyState>
        </div>
      ) : (
        <ChapterRunner
          // a fresh runner per chapter, so moving to the next chapter starts at its first step
          key={n}
          playerId={player.id}
          chapter={n}
          initialStep={c.step}
          lessonsDone={c.status === "quiz" || c.status === "complete"}
          earnedOn={c.earnedOn}
          best={c.best}
          quizOpen={c.quizOpen}
          plate={plateFor(player, pop)}
          canEdit={access.canAct}
          nextHref={n < CHAPTERS.length ? chapterHref(player.id, n + 1) : null}
          iqHref={iqHref}
        />
      )}
    </div>
  );
}
