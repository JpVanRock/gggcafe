import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading, buttonClass, secondaryButtonClass } from "@/components/ui";
import { CHAPTERS, MY_HABITS_MAX, MY_HABIT_LENGTH, NOTES_MAX, chapterLabel, courseLessons, visibleChapters } from "@/lib/advanced-book";
import { loadAdvanced } from "../../../advanced-data";
import { AdvancedNotFoundForAdmin, LEVEL_LABEL, advancedHref } from "../../../advanced";
import { ChapterDone, ChapterNotes, FoundationHabits, MyHabits } from "../../../advanced-client";
import { CourseRunner } from "../../../course-client";
import { CountPlan } from "../../../my-zone";
import type { HittingZones } from "@/lib/my-zone";
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
  // her own tools on the page: the count plan from My Zone (Pop Report)
  const zones = chapter.tools?.includes("count-plan")
    ? (((await supabase.from("hitting_zones").select("hot, strong, weak, notes").eq("player_id", player.id).maybeSingle()).data as HittingZones | null) ?? null)
    : null;

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

        {chapter.course && (
          <section>
            <Heading>The course</Heading>
            <CourseRunner
              playerId={player.id}
              chapter={chapter.slug}
              steps={chapter.course}
              lessons={courseLessons(chapter.course)}
              initialStep={work?.courseStep ?? 0}
              done={Boolean(work?.courseDoneAt)}
              canEdit={canEdit}
            />
          </section>
        )}

        {chapter.tools?.includes("game-plans") && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink/50 bg-pink/5 p-4">
            <p className="text-sm">Put this chapter to work: a plan before every game you pitch, and a look-back after it.</p>
            <Link href={`/players/${player.id}/training/game-plan`} className="font-semibold text-pink hover:underline">
              Your game plans →
            </Link>
          </section>
        )}

        {chapter.tools?.includes("count-plan") && (
          <section>
            <Heading>Your count plan</Heading>
            <CountPlan zones={zones} />
            <p className="mt-3 text-sm text-muted">
              Built from My Zone.{" "}
              <Link href={`/players/${player.id}/pop`} className="text-pink hover:underline">
                {zones && zones.hot.length + zones.strong.length + zones.weak.length ? "Change My Zone in your Pop Report →" : "Mark My Zone in your Pop Report →"}
              </Link>
            </p>
          </section>
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
          <ChapterDone
            playerId={player.id}
            chapter={chapter.slug}
            done={Boolean(work?.completedAt)}
            canEdit={canEdit}
            locked={chapter.course && !work?.courseDoneAt ? "Finish the course above to complete this chapter." : undefined}
          />
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
