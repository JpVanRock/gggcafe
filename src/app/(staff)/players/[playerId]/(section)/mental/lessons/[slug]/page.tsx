import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatLongDateAt } from "@/lib/dates";
import { sessionBySlug } from "@/lib/mental";
import { MENTAL_LESSONS, lessonBySlug, lessonNeighbors, lessonNumber, type LessonTool } from "@/lib/mental-lessons";
import { Badge } from "@/components/ui";
import { LessonCallout, LessonPager, LessonPairs, LessonParagraphs, LessonPart, LessonSteps, LessonTakeaway } from "@/components/lesson-parts";
import { CHAPTERS } from "@/lib/advanced-book";
import { loadMentalPlan } from "../../../../data";
import { loadMentalLesson } from "../../../../mental-data";
import { MENTAL_FIELDS } from "../../../../shared";
import { LessonAnswerForm } from "../../../../mental-game-client";
import { loadPlayer } from "../../../../section-data";
import { SectionShell } from "../../../section-shell";

export const metadata: Metadata = { title: "Lesson · Mental GP · GGG.Cafe" };

/** Where a lesson's tool lives on her Mental GP. */
function toolLink(base: string, tool: LessonTool): { href: string; label: string; note: string } | null {
  if (tool.startsWith("session:")) {
    const s = sessionBySlug(tool.slice("session:".length));
    return s ? { href: `${base}/session/${s.slug}`, label: s.title, note: `${s.kind === "breathing" ? "Breathing" : "Imagery"} · ${s.minutes} min` } : null;
  }
  switch (tool) {
    case "signals":
      return { href: `${base}#signals`, label: "My signals", note: "Green, yellow, red and your releases" };
    case "intensity":
      return { href: `${base}#intensity`, label: "Intensity check", note: "Rate yourself 1 to 10 against your zone" };
    case "scan":
      return { href: `${base}#scan`, label: "Monthly self-scan", note: "Ten skills, once a month" };
    case "journal":
      return { href: `${base}/journal`, label: "Practice journal", note: "A purpose before, a look-back after" };
    default:
      return null;
  }
}

// A Mental GP lesson (Standard, user 2026-11-12): the idea, how to build it, a rep for
// practice and the tools that go with it. Her answer to the question finishes it;
// coaches and her parents read it. A lesson with a plan field keeps the answer in her
// Mental Game Plan. Players with G3 Advanced get links to the chapters that go deeper.
export default async function MentalLessonPage({ params }: PageProps<"/players/[playerId]/mental/lessons/[slug]">) {
  const { playerId, slug } = await params;
  const lesson = lessonBySlug(slug);
  if (!lesson) notFound();
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId, "player.mental");
  const player = await loadPlayer(supabase, playerId);
  const [work, plan, g3] = await Promise.all([
    loadMentalLesson(supabase, player.id, lesson.slug),
    lesson.planField ? loadMentalPlan(supabase, player.id) : Promise.resolve(null),
    lesson.deeper.length
      ? supabase.from("player_advanced_access").select("player_id").eq("player_id", player.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const answer = lesson.planField ? (plan?.[lesson.planField] ?? null) : (work?.answer ?? null);
  const planLabel = lesson.planField ? MENTAL_FIELDS.find((f) => f.name === lesson.planField)?.label : undefined;
  const deeper = g3.data ? CHAPTERS.filter((c) => lesson.deeper.includes(c.slug) && c.status === "ready") : [];
  const base = `/players/${player.id}/mental`;
  const n = lessonNumber(lesson.slug);
  const { prev, next } = lessonNeighbors(lesson.slug);
  const tools = lesson.tools.map((t) => toolLink(base, t)).filter((t) => t !== null);
  const done = Boolean(work?.completed_at);

  return (
    <SectionShell title={lesson.title} subtitle={`Mental GP · Lesson ${n} of ${MENTAL_LESSONS.length} · ${lesson.minutes} min`}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`${base}#lessons`} className="text-sm text-link hover:underline">
            ← Mental GP
          </Link>
          {done && work?.completed_at && <Badge tone="neon">Done · {formatLongDateAt(work.completed_at)}</Badge>}
        </div>

        <p className="max-w-3xl text-lg font-semibold">{lesson.summary}</p>

        <LessonPart title="The idea">
          <LessonParagraphs paragraphs={lesson.idea} />
        </LessonPart>

        <LessonPart title="How to do it">
          <LessonSteps steps={lesson.steps} />
        </LessonPart>

        {lesson.situations && (
          <LessonPart title={lesson.situations.heading}>
            <LessonPairs items={lesson.situations.items} />
          </LessonPart>
        )}

        <LessonCallout label="Rep it at practice">
          <p className="text-ink/90">{lesson.rep}</p>
        </LessonCallout>

        <LessonTakeaway label="Lock it in" text={lesson.lockIn} />

        {tools.length > 0 && (
          <LessonPart title="Use it on your Mental GP">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tools.map((t) => (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    className="flex h-full flex-col gap-1 rounded-2xl border border-navy-600 bg-navy-900/70 p-4 transition hover:border-pink hover:bg-navy-800"
                  >
                    <span className="font-display font-bold tracking-wide text-highlight uppercase">{t.label}</span>
                    <span className="text-xs text-muted">{t.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </LessonPart>
        )}

        {deeper.length > 0 && (
          <LessonPart title="Go deeper in G3 Advanced">
            <ul className="grid gap-3 sm:grid-cols-2">
              {deeper.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/players/${player.id}/advanced/${c.slug}`}
                    className="flex h-full flex-col gap-1 rounded-2xl border border-navy-600 bg-navy-900/70 p-4 transition hover:border-pink hover:bg-navy-800"
                  >
                    <span className="font-display font-bold tracking-wide text-highlight uppercase">{c.title}</span>
                    <span className="text-xs text-muted">{c.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </LessonPart>
        )}

        <LessonPart title={access.isSelf ? "Finish the lesson" : "Her answer"}>
          {access.isSelf ? (
            <LessonAnswerForm
              playerId={player.id}
              lesson={lesson.slug}
              prompt={lesson.reflect.prompt}
              hint={lesson.reflect.hint}
              answer={answer}
              done={done}
              planLabel={planLabel}
            />
          ) : (
            <div className="flex max-w-3xl flex-col gap-2">
              <p className="text-sm font-semibold">{lesson.reflect.prompt}</p>
              {answer ? (
                <p className="text-sm whitespace-pre-wrap text-ink/90">{answer}</p>
              ) : (
                <p className="text-sm text-muted">Not written yet.</p>
              )}
              {planLabel && <p className="text-xs text-muted">Kept in her Mental Game Plan as &quot;{planLabel}.&quot;</p>}
              {!done && answer && <p className="text-xs text-muted">She hasn&apos;t finished this lesson yet.</p>}
            </div>
          )}
        </LessonPart>

        <LessonPager
          label="Other lessons"
          prev={prev && { href: `${base}/lessons/${prev.slug}`, label: `Lesson ${n - 1}: ${prev.title}` }}
          next={next && { href: `${base}/lessons/${next.slug}`, label: `Lesson ${n + 1}: ${next.title}` }}
        />
      </div>
    </SectionShell>
  );
}
