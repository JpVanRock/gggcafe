import type { Metadata } from "next";
import Link from "next/link";
import { Disclosure, buttonClass, eyebrowClass } from "@/components/ui";
import { ProgressBar } from "@/components/progress-bar";
import { SpeedStripes } from "@/components/athletic";
import { LeaderBadge } from "@/components/leader-badge";
import { ScrollToHash } from "@/components/scroll-to-hash";
import {
  BONUS, BONUS_INTRO, BONUS_SHELVES, BONUS_TITLE, COACH_NOTES, CORE_PARTS, GUIDE_CLOSER, GUIDE_INTRO, GUIDE_TITLE, LADDER, LESSONS, LIGHT_INTRO, LIGHT_KEYS, LIGHT_LESSONS,
  LIGHT_PARTS, PROGRAM_NAME, bonusProgress, courseReady, guideProgress, lessonNumber, programLessons, programTitle, type Lesson, type LessonWork,
} from "@/lib/leadership-guide";
import { LeaderToggle } from "../../../leadership-client";
import { LeadershipClosed, leadershipContext, leadershipHref } from "../../../leadership";
import { advancedHref } from "../../../advanced";
import { SectionShell } from "../../section-shell";

export const metadata: Metadata = { title: "G3 Leadership Guide · GGG.Cafe" };

function LessonList({ playerId, lessons, work, prefix }: { playerId: string; lessons: Lesson[]; work: LessonWork[]; prefix: string }) {
  return (
    <ol className="grid gap-2 md:grid-cols-2">
      {lessons.map((l) => {
        const w = work.find((x) => x.lesson === l.slug);
        const answered = l.questions.filter((q) => w?.answers[q.key]).length;
        return (
          <li key={l.slug}>
            <Link
              href={leadershipHref(playerId, l.slug)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition hover:border-pink hover:bg-navy-800 ${
                w?.completedAt ? "border-neon/50" : "border-navy-600"
              }`}
            >
              <span className="w-10 shrink-0 font-display text-2xl font-bold text-highlight tabular-nums">
                {prefix}
                {String(lessonNumber(l.slug)).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{l.title}</span>
                <span className={`block font-mono text-2xs tracking-wider uppercase ${w?.completedAt ? "text-highlight" : "text-muted"}`}>
                  {w?.completedAt ? "Complete ✓" : `${answered} of ${l.questions.length} answered`}
                </span>
              </span>
              <span className="text-sm text-link">→</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

const heading = "mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

export default async function LeadershipPage({ params }: PageProps<"/players/[playerId]/advanced/leadership">) {
  const { playerId } = await params;
  const { access, player, book, lead, certificate, name } = await leadershipContext(playerId);
  if (!lead.open) {
    return (
      <SectionShell title={GUIDE_TITLE} subtitle="G3 Advanced · Leadership">
        <div className="flex flex-col gap-6">
          {certificate && (
            <Link href={leadershipHref(player.id, "certificate")} className="flex items-center gap-3 self-start rounded-xl border border-neon/60 px-4 py-3 hover:bg-navy-800">
              <LeaderBadge size={28} />
              <span className="font-semibold">Certificate of Leadership →</span>
            </Link>
          )}
          <LeadershipClosed playerId={player.id} name={name} hasAdvanced={book.unlocked} picked={lead.picked} canManage={access.canManage} />
        </div>
      </SectionShell>
    );
  }

  const program = lead.program;
  const light = program === "light";
  const title = programTitle(program);
  const lessons = programLessons(program);
  const progress = guideProgress(lead.work, program);
  const extra = bonusProgress(lead.work);
  const next = progress.next ?? lessons[0];
  const ready = courseReady(lead.work, lead.committedAt, program);
  const parts = light
    ? LIGHT_PARTS.map((part) => ({ part, lessons: LIGHT_LESSONS.filter((l) => l.part === part) }))
    : CORE_PARTS.map((part) => ({ part, lessons: LESSONS.filter((l) => l.part === part) }));
  const planStatus = lead.review.signedAt
    ? "Signed off by your coach ✓"
    : lead.committedAt
      ? ready
        ? "Committed · waiting on your coach"
        : "Committed · finish every lesson"
      : "Not written yet";
  return (
    <SectionShell title={title} subtitle={`G3 Advanced · ${name}'s leadership`}>
      <div className="flex flex-col gap-8">
        <Link href={advancedHref(player.id)} className="-mt-2 self-start text-sm text-link hover:underline">
          ← {book.title}
        </Link>

        {certificate && (
          <Link
            href={leadershipHref(player.id, "certificate")}
            className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-neon bg-linear-to-r from-neon/10 to-pink/10 p-4 transition hover:from-neon/15"
          >
            <LeaderBadge size={52} label />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl font-bold tracking-wide text-highlight uppercase">Team Leader</span>
              <span className="block text-sm text-muted">Course complete. View and print the Certificate of Leadership.</span>
            </span>
            <span className="font-mono text-xs tracking-wider text-ink uppercase">Certificate →</span>
          </Link>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <p className="flex items-center gap-3 font-mono text-xs tracking-[0.3em] text-pink-soft uppercase">
              <SpeedStripes className="h-3 w-9 text-link" />
              Read this first
            </p>
            <div className="mt-3 flex flex-col gap-3 text-ink/90">
              {(light ? LIGHT_INTRO : GUIDE_INTRO).map((p, i) => (
                <p key={i} className={i === 0 ? "text-lg font-semibold text-ink" : undefined}>
                  {p}
                </p>
              ))}
              <p className="font-display text-xl font-bold tracking-wide text-highlight uppercase">{GUIDE_CLOSER}</p>
            </div>
            <div className="mt-6 max-w-md">
              <ProgressBar value={progress.done} max={progress.total} label={`${progress.done} of ${progress.total} lessons complete`} />
            </div>
            <Link href={leadershipHref(player.id, next.slug)} className={`${buttonClass} mt-5`}>
              {progress.done === 0 && !lead.work.length ? "Start Lesson 1" : progress.next ? `Continue: ${progress.next.title}` : "Read it again"}
            </Link>
          </div>

          {light ? (
            <div className="rounded-2xl border-2 border-pink bg-linear-to-b from-navy-950 to-navy-900 p-5">
              <p className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">What you&apos;ll build</p>
              <ol className="mt-4 flex flex-col gap-2">
                {LIGHT_KEYS.map((key, i) => (
                  <li key={key} className="flex items-center gap-3 border-b border-navy-700 pb-2 last:border-0">
                    <span className="w-7 font-display text-xl font-bold text-highlight tabular-nums">{i + 1}</span>
                    <span className="text-sm">{key}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
          /* the ladder: top rung first */
          <div className="rounded-2xl border-2 border-pink bg-linear-to-b from-navy-950 to-navy-900 p-5">
            <p className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">The leadership ladder</p>
            <ol className="mt-4 flex flex-col-reverse gap-2">
              {LADDER.map((rung, i) => (
                <li key={rung} className="flex items-center gap-3 border-b border-navy-700 pb-2 last:border-0">
                  <span className="w-7 font-display text-xl font-bold text-highlight tabular-nums">{i + 1}</span>
                  <span className="text-sm">{rung}</span>
                  {i === 3 && <span className="ml-auto font-mono text-2xs tracking-wider text-muted uppercase">Lead yourself ↓</span>}
                  {i === 6 && <span className="ml-auto font-mono text-2xs tracking-wider text-muted uppercase">Lead others ↓</span>}
                </li>
              ))}
            </ol>
          </div>
          )}
        </div>

        {parts.map(({ part, lessons: list }) => (
          <section key={part}>
            <h2 className={heading}>{part}</h2>
            <LessonList playerId={player.id} lessons={list} work={lead.work} prefix="" />
          </section>
        ))}

        <Link
          href={leadershipHref(player.id, "plan")}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-neon bg-neon/5 p-5 transition hover:bg-neon/10"
        >
          <span>
            <span className="block font-display text-2xl font-bold tracking-wide text-highlight uppercase">{light ? "My Leader Plan" : "My Leadership Plan"}</span>
            <span className="block text-sm text-muted">
              {light
                ? "Why you want to lead, your habit, your goal, your commitment, and your coach's sign-off."
                : "Why you lead, your habits, your goals, your commitment, and your coach's sign-off."}
            </span>
          </span>
          <span className="font-mono text-xs tracking-wider text-ink uppercase">{planStatus} →</span>
        </Link>

        {!light && (
        <section id="extra-reps" className="scroll-mt-24 rounded-2xl border border-navy-700 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-wide text-highlight uppercase">{BONUS_TITLE}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">{BONUS_INTRO}</p>
            </div>
            <div className="w-full max-w-xs">
              <ProgressBar value={extra.done} max={extra.total} label={`${extra.done} of ${extra.total} extra reps`} />
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-6">
            {BONUS_SHELVES.map((shelf) => (
              <div key={shelf}>
                <h3 className={heading}>{shelf}</h3>
                <LessonList playerId={player.id} lessons={BONUS.filter((l) => l.part === shelf)} work={lead.work} prefix="X" />
              </div>
            ))}
          </div>
        </section>
        )}

        {access.canManage && (
          <div className="flex flex-col gap-3 rounded-xl border border-navy-700 p-4">
            <p className={eyebrowClass}>Coaches</p>
            <p className="text-sm text-muted">
              {ready
                ? lead.review.signedAt
                  ? `${name} is signed off. Her certificate and Leader Badge are awarded.`
                  : `${name} finished every lesson and committed to her plan. Sign off on her plan page to award her certificate.`
                : `Certificate and Leader Badge: all ${lessons.length} ${PROGRAM_NAME[program]} lessons complete, her plan committed, then your sign-off on her plan page.${light ? "" : " Extra Reps are optional."}`}
            </p>
            <Disclosure summary="What usually gets in the way of player leadership">
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {COACH_NOTES.map((n) => (
                  <li key={n} className="flex gap-2">
                    <span className="text-link">·</span>
                    {n}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">
                What works: meet with your leaders before the season, run one What Would You Do? situation a week with players leading the talk, and check
                their plans at the dates they set.
              </p>
            </Disclosure>
            <LeaderToggle playerId={player.id} name={name} program={program} />
          </div>
        )}
        <ScrollToHash />
      </div>
    </SectionShell>
  );
}
