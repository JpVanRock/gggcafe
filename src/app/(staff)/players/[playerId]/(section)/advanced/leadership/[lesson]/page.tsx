import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading, buttonClass, secondaryButtonClass } from "@/components/ui";
import {
  ANSWER_MAX, BONUS, BONUS_TITLE, ENGAGEMENT_ASK, ENGAGEMENT_LEVELS, GUIDE_TITLE, HABITS, LEADER_ROLES, LESSONS, RUBRIC, RUBRIC_LEVELS,
  SCENARIOS, SCENARIO_GROUPS, STARTER_GROUPS, findLesson, lessonLabel,
} from "@/lib/leadership-guide";
import { AnswerBox, HabitsTool, LessonDone, RubricTool, StepChecks } from "../../../../leadership-client";
import { LeadershipClosed, leadershipContext, leadershipHref } from "../../../../leadership";
import { SectionShell } from "../../../section-shell";

export const metadata: Metadata = { title: "G3 Leadership Guide · GGG.Cafe" };

export default function LeadershipLessonPage({ params }: PageProps<"/players/[playerId]/advanced/leadership/[lesson]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Lesson params={params} />
    </Suspense>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">{children}</h2>;
}

async function Lesson({ params }: Pick<PageProps<"/players/[playerId]/advanced/leadership/[lesson]">, "params">) {
  const { playerId, lesson: slug } = await params;
  const lesson = findLesson(slug);
  if (!lesson) notFound();
  const { access, player, book, lead, name } = await leadershipContext(playerId);
  if (!lead.open) {
    return (
      <SectionShell title={GUIDE_TITLE} subtitle="G3 Advanced · Leadership">
        <LeadershipClosed playerId={player.id} name={name} hasAdvanced={book.unlocked} picked={lead.picked} canManage={access.canManage} />
      </SectionShell>
    );
  }

  const list = lesson.kind === "core" ? LESSONS : BONUS;
  const index = list.indexOf(lesson);
  const work = lead.work.find((w) => w.lesson === lesson.slug);
  const answers = work?.answers ?? {};
  const prev = list[index - 1];
  const next = list[index + 1];
  const canEdit = access.canAct;
  const of = lesson.kind === "core" ? `of ${LESSONS.length}` : `of ${BONUS.length} · ${BONUS_TITLE}`;
  const answerBox = (key: string, label: string, rows = 3) => (
    <AnswerBox playerId={player.id} lesson={lesson.slug} answerKey={key} label={label} initial={answers[key] ?? ""} canEdit={canEdit} maxLength={ANSWER_MAX} rows={rows} />
  );

  return (
    <SectionShell title={lesson.title} subtitle={`${lessonLabel(lesson)} ${of} · ${lesson.part} · ${GUIDE_TITLE}`}>
      <div className="flex flex-col gap-10">
        <Link href={leadershipHref(player.id)} className="-mt-2 self-start text-sm text-pink hover:underline">
          ← Leadership Guide
        </Link>

        <p className="max-w-3xl border-l-4 border-neon pl-4 text-2xl leading-snug font-semibold text-ink sm:text-3xl">{lesson.bigIdea}</p>

        <section className="flex max-w-3xl flex-col gap-4 text-ink/90">
          {lesson.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        {lesson.lists?.map((l) => (
          <section key={l.title}>
            <Heading>{l.title}</Heading>
            <ol className="grid gap-2 md:grid-cols-2">
              {l.points.map((p, i) => (
                <li key={p} className="flex items-start gap-3 rounded-lg border border-navy-700 px-3 py-2.5 text-sm">
                  <span className="font-display text-lg font-bold text-highlight tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="pt-0.5">{p}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}

        {lesson.tool === "roles" && (
          <section>
            <Heading>Seven kinds of leaders</Heading>
            <ul className="grid gap-4 md:grid-cols-2">
              {LEADER_ROLES.map((r) => (
                <li key={r.key} className="flex flex-col gap-3 rounded-xl border border-navy-700 p-4">
                  <div>
                    <p className="font-display text-xl font-bold tracking-wide text-highlight uppercase">{r.title}</p>
                    <p className="mt-1 text-sm">{r.does}</p>
                    <p className="mt-1 font-mono text-[11px] tracking-wider text-pink-soft uppercase">Brings: {r.brings}</p>
                  </div>
                  {answerBox(r.key, "Who fits this on our team?", 1)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {lesson.tool === "engagement" && (
          <section>
            <Heading>What&apos;s your level?</Heading>
            <RubricTool
              playerId={player.id}
              lesson={lesson.slug}
              areas={ENGAGEMENT_ASK}
              levels={ENGAGEMENT_LEVELS}
              self={answers}
              coach={{}}
              canEdit={canEdit}
              canRate={false}
              showCoach={false}
            />
          </section>
        )}

        {lesson.tool === "starters" && (
          <section>
            <Heading>Conversation starters</Heading>
            <div className="grid gap-5">
              {STARTER_GROUPS.map((g) => (
                <div key={g.title}>
                  <h3 className="mb-2 text-sm font-semibold text-highlight">{g.title}</h3>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {g.lines.map((s) => (
                      <li key={s} className="rounded-lg border border-pink/40 bg-pink/5 px-4 py-3 text-sm font-semibold">
                        &ldquo;{s}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-6 max-w-2xl">{answerBox("my-starter", "My starter, in my own words", 2)}</div>
          </section>
        )}

        {lesson.tool === "habits" && (
          <section>
            <Heading>The habits</Heading>
            <HabitsTool playerId={player.id} lesson={lesson.slug} habits={HABITS} answers={answers} canEdit={canEdit} />
          </section>
        )}

        {lesson.tool === "scenarios" && (
          <section>
            <Heading>What would you do?</Heading>
            <p className="mb-4 font-mono text-[11px] tracking-wider text-muted uppercase">
              {SCENARIOS.filter((s) => answers[s.key]).length} of {SCENARIOS.length} answered
            </p>
            <div className="grid gap-3">
              {SCENARIO_GROUPS.map((g) => {
                const group = SCENARIOS.filter((s) => s.group === g);
                const answered = group.filter((s) => answers[s.key]).length;
                return (
                  <details key={g} className="group rounded-xl border border-navy-700 open:border-pink/60">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-semibold">
                      <span>{g}</span>
                      <span className="font-mono text-[11px] tracking-wider text-muted uppercase">
                        {answered} / {group.length} <span className="ml-1 inline-block transition group-open:rotate-90">›</span>
                      </span>
                    </summary>
                    <div className="grid gap-5 border-t border-navy-700 p-4 md:grid-cols-2">
                      {group.map((s) => (
                        <div key={s.key} className="flex flex-col gap-3 rounded-xl border border-navy-700 p-4">
                          <div>
                            <p className="font-mono text-[11px] tracking-wider text-pink-soft uppercase">{s.title}</p>
                            <p className="mt-1 text-sm">{s.situation}</p>
                          </div>
                          {answerBox(s.key, "What I'd do")}
                          <details className="rounded-lg bg-navy-800/60 px-3 py-2 text-sm">
                            <summary className="cursor-pointer font-semibold text-highlight">A leader&apos;s move</summary>
                            <p className="mt-2 text-ink/90">{s.move}</p>
                          </details>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        )}

        {lesson.tool === "rubric" && (
          <section>
            <Heading>Rate yourself</Heading>
            <RubricTool
              playerId={player.id}
              lesson={lesson.slug}
              areas={RUBRIC}
              levels={RUBRIC_LEVELS}
              self={answers}
              coach={lead.review.ratings}
              canEdit={canEdit}
              canRate={access.canManage}
            />
          </section>
        )}

        <section>
          <Heading>Your turn</Heading>
          <div className="grid max-w-3xl gap-6">
            {lesson.questions.map((q) => (
              <div key={q.key}>{answerBox(q.key, q.text)}</div>
            ))}
          </div>
        </section>

        <section>
          <Heading>Try this</Heading>
          <div className="max-w-3xl">
            <StepChecks playerId={player.id} lesson={lesson.slug} steps={lesson.steps} done={work?.steps ?? []} canEdit={canEdit} />
          </div>
        </section>

        <LessonDone playerId={player.id} lesson={lesson.slug} done={Boolean(work?.completedAt)} canEdit={canEdit} />

        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-700 pt-5" aria-label="Lessons">
          {prev ? (
            <Link href={leadershipHref(player.id, prev.slug)} className={secondaryButtonClass}>
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={leadershipHref(player.id, next.slug)} className={buttonClass}>
              {lessonLabel(next)}: {next.title} →
            </Link>
          ) : lesson.kind === "core" ? (
            <Link href={leadershipHref(player.id, "plan")} className={buttonClass}>
              Write my Leadership Plan →
            </Link>
          ) : (
            <Link href={`${leadershipHref(player.id)}#extra-reps`} className={buttonClass}>
              Back to {BONUS_TITLE} →
            </Link>
          )}
        </nav>
      </div>
    </SectionShell>
  );
}
