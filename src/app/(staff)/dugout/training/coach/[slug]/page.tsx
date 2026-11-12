import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatLongDateAt } from "@/lib/dates";
import { COACH_MODULES, moduleBySlug, moduleNeighbors, moduleNumber } from "@/lib/coach-training";
import { lessonBySlug, lessonNumber } from "@/lib/mental-lessons";
import { Badge, TableScroll, tableClass, tdClass, thClass } from "@/components/ui";
import { LessonCallout, LessonPager, LessonParagraphs, LessonPart, LessonSteps, LessonTakeaway } from "@/components/lesson-parts";
import { loadDugoutTeam } from "../../../data";
import { NoOwnTeam } from "../../../team-picker";
import { TrainingNav } from "../../nav";
import { CoachNotesForm } from "../notes-form";

export const metadata: Metadata = { title: "Coach training · Training · Coaches Dugout · GGG.Cafe" };

// One module of the coaches' Mental Game course (user, 2026-11-12): why it matters,
// what to do, what to say, one thing to try this week, and the coach's own notes.
export default async function CoachModulePage({ params, searchParams }: PageProps<"/dugout/training/coach/[slug]">) {
  const { slug } = await params;
  const mod = moduleBySlug(slug);
  if (!mod) notFound();
  const user = await requireStaffPage();
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { team } = dugout;
  const { data: work } = await supabase
    .from("coach_mental_lessons")
    .select("notes, completed_at")
    .eq("user_id", user.id)
    .eq("lesson", mod.slug)
    .maybeSingle();
  const n = moduleNumber(mod.slug);
  const { prev, next } = moduleNeighbors(mod.slug);
  const q = `?team=${team.id}`;
  const pairs = mod.pairsWith.map((s) => lessonBySlug(s)).filter((l) => l !== undefined);

  return (
    <div className="flex flex-col gap-8">
      <TrainingNav current="coach" teamId={team.id} head={isHeadCoach(user.staff.role)} />

      <article className="flex flex-col gap-8 rounded-2xl border border-navy-700 bg-navy-900/70 p-5 sm:p-8">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/dugout/training/coach${q}`} className="text-sm text-link hover:underline">
              ← Coach training
            </Link>
            {work?.completed_at && <Badge tone="neon">Done · {formatLongDateAt(work.completed_at)}</Badge>}
          </div>
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-pink-soft uppercase">
              Coaching the Mental Game · Module {n} of {COACH_MODULES.length} · {mod.minutes} min
            </p>
            <h2 className="mt-1 text-2xl leading-tight font-bold tracking-wide text-highlight uppercase sm:text-3xl">{mod.title}</h2>
            <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-pink" />
          </div>
          <p className="max-w-3xl text-lg font-semibold">{mod.summary}</p>
        </header>

        <LessonPart title="Why it matters" level="h3">
          <LessonParagraphs paragraphs={mod.why} />
        </LessonPart>

        <LessonPart title="What to do" level="h3">
          <LessonSteps steps={mod.steps} />
        </LessonPart>

        {mod.sayThis && (
          <LessonPart title="Say this, not this" level="h3">
            <TableScroll label="Say this, not this" className="max-w-3xl">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Say this</th>
                    <th className={thClass}>Not this</th>
                  </tr>
                </thead>
                <tbody>
                  {mod.sayThis.map((s) => (
                    <tr key={s.say}>
                      <td className={`${tdClass} align-top font-semibold`}>“{s.say}”</td>
                      <td className={`${tdClass} align-top text-muted`}>“{s.notThis}”</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </LessonPart>
        )}

        <LessonCallout label="Try it this week">
          <p className="text-ink/90">{mod.thisWeek}</p>
        </LessonCallout>

        <LessonTakeaway label="Remember" text={mod.takeaway} />

        {pairs.length > 0 && (
          <LessonPart title="Your players' side" level="h3">
            <p className="max-w-3xl text-sm text-ink/90">
              Goes with {pairs.length === 1 ? "the lesson" : "the lessons"}{" "}
              {pairs.map((l, i) => (
                <span key={l.slug}>
                  {i > 0 && (i === pairs.length - 1 ? " and " : ", ")}
                  <span className="font-semibold">
                    {lessonNumber(l.slug)}. {l.title}
                  </span>
                </span>
              ))}{" "}
              on each player&apos;s Mental GP. Point your players to it, and use the same words they read there.
            </p>
          </LessonPart>
        )}

        <LessonPart title="Your notes" level="h3">
          <CoachNotesForm lesson={mod.slug} prompt={mod.reflect.prompt} hint={mod.reflect.hint} notes={work?.notes ?? null} done={Boolean(work?.completed_at)} />
        </LessonPart>

        <LessonPager
          label="Other modules"
          prev={prev && { href: `/dugout/training/coach/${prev.slug}${q}`, label: `Module ${n - 1}: ${prev.title}` }}
          next={next && { href: `/dugout/training/coach/${next.slug}${q}`, label: `Module ${n + 1}: ${next.title}` }}
        />
      </article>
    </div>
  );
}
