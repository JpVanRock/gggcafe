import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading, buttonClass, secondaryButtonClass } from "@/components/ui";
import { CHAPTERS, MY_HABITS_MAX, MY_HABIT_LENGTH, NOTES_MAX, chapterLabel, visibleChapters } from "@/lib/advanced-book";
import { loadAdvanced } from "../../../advanced-data";
import { AdvancedNotFoundForAdmin, LEVEL_LABEL, advancedHref } from "../../../advanced";
import { ChapterDone, ChapterNotes, FoundationHabits, MyHabits } from "../../../advanced-client";
import { firstName, loadPlayer } from "../../../section-data";
import { SectionShell } from "../../section-shell";

export const metadata: Metadata = { title: "G3 Advanced · GGG.Cafe" };

export default function AdvancedChapterPage({ params }: PageProps<"/players/[playerId]/advanced/[chapter]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Chapter params={params} />
    </Suspense>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">{children}</h2>;
}

async function Chapter({ params }: Pick<PageProps<"/players/[playerId]/advanced/[chapter]">, "params">) {
  const { playerId, chapter: slug } = await params;
  if (!CHAPTERS.some((c) => c.slug === slug)) notFound();
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const book = await loadAdvanced(supabase, player.id);
  const name = firstName(player);
  if (!book.unlocked) {
    if (access.user.staff?.role !== "admin") notFound();
    return <AdvancedNotFoundForAdmin playerId={player.id} name={name} />;
  }

  // her book: position chapters only for positions a coach has confirmed
  const chapters = visibleChapters(book.confirmed);
  const index = chapters.findIndex((c) => c.slug === slug);
  if (index < 0) notFound();
  const chapter = chapters[index];
  const work = book.work.find((w) => w.chapter === chapter.slug);
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const canEdit = access.canAct;
  const coming = chapter.status === "coming";

  return (
    <SectionShell title={chapter.title} subtitle={`${chapterLabel(chapter, chapters)}${chapter.kicker ? ` · ${chapter.kicker}` : ""} · ${book.title} · ${LEVEL_LABEL}`}>
      <div className="flex flex-col gap-10">
        <Link href={advancedHref(player.id)} className="-mt-2 self-start text-sm text-pink hover:underline">
          ← Contents
        </Link>

        {chapter.question && <p className="text-2xl leading-snug font-semibold text-ink sm:text-3xl">{chapter.question}</p>}

        {coming ? (
          <p className="rounded-xl border border-dashed border-navy-600 p-5 text-muted">
            This chapter is being written. Its foundation will show up here when it&apos;s ready. You can start building your own habits
            and notes for it now.
          </p>
        ) : (
          chapter.why && (
            <section>
              <Heading>{chapter.kind === "intro" ? "Read this first" : "Why it matters"}</Heading>
              <div className="flex max-w-3xl flex-col gap-4 text-ink/90">
                {chapter.why.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )
        )}

        {chapter.habits && (
          <section>
            <Heading>The foundation</Heading>
            <FoundationHabits playerId={player.id} chapter={chapter.slug} habits={chapter.habits} owned={work?.owned ?? []} canEdit={canEdit} />
          </section>
        )}

        {chapter.kind === "chapter" && (
          <section className="grid gap-8 lg:grid-cols-2">
            <div>
              <Heading>Build on it: my habits</Heading>
              <MyHabits playerId={player.id} chapter={chapter.slug} mine={work?.mine ?? []} canEdit={canEdit} max={MY_HABITS_MAX} maxLength={MY_HABIT_LENGTH} />
            </div>
            <div>
              <Heading>My notes</Heading>
              <ChapterNotes playerId={player.id} chapter={chapter.slug} notes={work?.notes ?? null} canEdit={canEdit} maxLength={NOTES_MAX} />
            </div>
          </section>
        )}

        {chapter.kind === "chapter" && !coming && (
          <ChapterDone playerId={player.id} chapter={chapter.slug} done={Boolean(work?.completedAt)} canEdit={canEdit} />
        )}

        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-700 pt-5" aria-label="Chapters">
          {prev ? (
            <Link href={advancedHref(player.id, prev.slug)} className={secondaryButtonClass}>
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={advancedHref(player.id, next.slug)} className={buttonClass}>
              {chapterLabel(next, chapters)}: {next.title} →
            </Link>
          )}
        </nav>
      </div>
    </SectionShell>
  );
}
