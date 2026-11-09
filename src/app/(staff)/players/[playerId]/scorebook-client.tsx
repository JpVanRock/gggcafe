"use client";

// One How to Keep the Book chapter: step-through lessons (with quick checks,
// tap-to-explore pictures and tap-the-fielders exercises), then the chapter quiz,
// graded in the database through the same test flow as the other IQ tests.
import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClass, secondaryButtonClass, eyebrowClass, cardClass } from "@/components/ui";
import { ProgressBar } from "@/components/progress-bar";
import { ManagerAward } from "@/components/manager-award";
import { PositionField, ScoreBox, ScoreVisual } from "@/components/scorebook";
import { CHAPTERS, CHAPTER_COUNT, PASS_PCT, QUIZ_LENGTH, playNotation, type Step, type Visual } from "@/lib/scorebook";
import { answerIqLevelQuestion, finishIqLevel, startIqLevel, type LevelQuestion } from "./iq-actions";
import { finishScorebookLessons, saveScorebookStep } from "./scorebook-actions";
import type { Nameplate } from "./iq-tests-client";
import { confirmAction } from "@/components/confirm-submit";

const LETTERS = ["A", "B", "C", "D"];

type Mode = "lesson" | "ready" | "quiz" | "result";
type Quiz = { attemptId: string; questions: LevelQuestion[]; done: Record<string, boolean>; index: number };
type Feedback = { chosen: number; correct: boolean; correctIndex: number; explanation: string | null };

function choiceClass(state: "right" | "wrong" | "idle") {
  return `flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${
    state === "right" ? "border-neon bg-neon/15" : state === "wrong" ? "border-pink bg-pink/15" : "border-navy-600 hover:border-pink disabled:hover:border-navy-600"
  }`;
}

/** A quick check inside a lesson: instant feedback, nothing saved. */
function LessonCheck({ check }: { check: NonNullable<Step["check"]> }) {
  const [chosen, setChosen] = useState<number | null>(null);
  return (
    <div className="mt-5 rounded-xl border border-navy-600 p-4">
      <p className={eyebrowClass}>Quick check</p>
      <p className="mt-1 font-semibold">{check.question}</p>
      <ol className="mt-3 grid gap-2">
        {check.choices.map((c, i) => {
          const state = chosen === null ? "idle" : i === check.answer ? "right" : i === chosen ? "wrong" : "idle";
          return (
            <li key={i}>
              <button type="button" disabled={chosen !== null} onClick={() => setChosen(i)} className={choiceClass(state)}>
                <span className="font-mono font-bold text-muted">{LETTERS[i]}</span>
                <span>{c}</span>
                {state === "right" && <span className="ml-auto font-bold text-highlight">✓</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {chosen !== null && (
        <div className="mt-3" aria-live="polite">
          <p className={`font-bold ${chosen === check.answer ? "text-highlight" : "text-pink-soft"}`}>{chosen === check.answer ? "Correct." : "Not quite."}</p>
          <p className="mt-1 text-base text-ink/90">{check.why}</p>
          {chosen !== check.answer && (
            <button type="button" onClick={() => setChosen(null)} className="mt-2 text-sm text-pink-soft underline">
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Tap the fielders in the order they handled the ball; the notation builds as she taps. */
function TapPlay({ tap }: { tap: NonNullable<Step["tap"]> }) {
  const [picked, setPicked] = useState<number[]>([]);
  const finished = picked.length >= tap.answer.length;
  const right = finished && picked.every((n, i) => n === tap.answer[i]);
  return (
    <div className="mt-5">
      <p className={eyebrowClass}>Your turn</p>
      <p className="mt-1 font-semibold">{tap.prompt}</p>
      <PositionField
        spec={{ kind: "field" }}
        picked={picked}
        onPick={(n) => !finished && setPicked((p) => [...p, n])}
        className="mt-3 w-full max-w-md"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3" aria-live="polite">
        <span className="rounded-lg border border-navy-600 px-3 py-1.5 font-display text-2xl font-bold tabular-nums text-highlight">
          {!picked.length ? "–" : finished ? playNotation(picked) : `${picked.join("-")}-`}
        </span>
        {finished && (
          <span className={`font-bold ${right ? "text-highlight" : "text-pink-soft"}`}>
            {right ? `Correct: ${playNotation(tap.answer)}.` : "Not quite. Follow the ball and try again."}
          </span>
        )}
        {picked.length > 0 && !right && (
          <button type="button" onClick={() => setPicked([])} className="text-sm text-pink-soft underline">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/** Tap a part to light it up. */
function Explore({ items }: { items: NonNullable<Step["explore"]> }) {
  const [i, setI] = useState(0);
  const item = items[i];
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Parts">
        {items.map((it, k) => (
          <button
            key={it.label}
            type="button"
            aria-pressed={k === i}
            onClick={() => setI(k)}
            className={`rounded-full border px-3 py-1 font-mono text-2xs tracking-wider uppercase ${
              k === i ? "border-pink bg-pink/15 text-ink" : "border-navy-600 text-muted hover:border-pink"
            }`}
          >
            {it.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm" aria-live="polite">
        <span className="font-semibold text-highlight">{item.label}:</span> {item.text}
      </p>
      <ScoreVisual visual={item.visual} className="mt-3" />
    </div>
  );
}

function LessonStep({ step }: { step: Step }) {
  const pictures = [step.visual, step.zoom].filter((v): v is Visual => Boolean(v));
  const text = (
    <div>
      <h3 className="font-display text-2xl font-bold tracking-wide text-highlight uppercase">{step.title}</h3>
      {step.body.map((p, i) => (
        <p key={i} className="mt-3 max-w-prose text-ink/90">
          {p}
        </p>
      ))}
      {step.explore && <Explore items={step.explore} />}
      {step.tap && <TapPlay tap={step.tap} />}
      {step.check && <LessonCheck check={step.check} />}
    </div>
  );
  if (pictures.length === 2) {
    // the half-inning: the page and her box, side by side under the text
    return (
      <div className="flex flex-col gap-5">
        {text}
        <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <ScoreVisual visual={pictures[0]} />
          <div>
            <p className={`${eyebrowClass} mb-2`}>At the plate</p>
            <ScoreBox marks={pictures[1] as Extract<Visual, { kind: "box" }>} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`grid items-start gap-6 ${pictures.length ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : ""}`}>
      {text}
      {pictures[0] && <ScoreVisual visual={pictures[0]} />}
    </div>
  );
}

export function ChapterRunner({
  playerId,
  chapter: n,
  initialStep,
  lessonsDone,
  earnedOn,
  best,
  quizOpen,
  plate,
  canEdit,
  nextHref,
  iqHref,
}: {
  playerId: string;
  chapter: number;
  initialStep: number;
  lessonsDone: boolean;
  earnedOn: string | null;
  best: { correct: number; total: number } | null;
  quizOpen: boolean;
  plate: Nameplate;
  canEdit: boolean;
  /** the next chapter's page, when there is one */
  nextHref: string | null;
  iqHref: string;
}) {
  const chapter = CHAPTERS.find((c) => c.n === n)!;
  const last = chapter.steps.length - 1;
  const [mode, setMode] = useState<Mode>(lessonsDone && !earnedOn ? "ready" : "lesson");
  const [index, setIndex] = useState(lessonsDone || earnedOn ? 0 : Math.min(initialStep, last));
  const [furthest, setFurthest] = useState(initialStep);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [result, setResult] = useState<{ correct: number; total: number; passed: boolean; awardEarned: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go(to: number) {
    setIndex(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (to > furthest) {
      setFurthest(to);
      if (canEdit) {
        startTransition(async () => {
          await saveScorebookStep({ playerId, chapter: n, step: to });
        });
      }
    }
  }

  function reread() {
    setMode("lesson");
    setIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finishLessons() {
    setError(null);
    if (!canEdit) return setMode("ready");
    startTransition(async () => {
      const res = await finishScorebookLessons({ playerId, chapter: n });
      if (res.error) return setError(res.error);
      setMode("ready");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function startQuiz(restart = false) {
    setError(null);
    startTransition(async () => {
      const res = await startIqLevel({ playerId, track: "scorebook", level: n, restart });
      if (res.error || !res.attemptId || !res.questions) return setError(res.error ?? "Couldn't start the quiz.");
      const done = Object.fromEntries(Object.entries(res.answered ?? {}).map(([id, a]) => [id, a.correct]));
      const first = res.questions.findIndex((q) => !(q.id in done));
      setQuiz({ attemptId: res.attemptId, questions: res.questions, done, index: first < 0 ? res.questions.length : first });
      setFeedback(null);
      setResult(null);
      setMode("quiz");
    });
  }

  function answer(chosen: number) {
    if (!quiz) return;
    const q = quiz.questions[quiz.index];
    startTransition(async () => {
      const res = await answerIqLevelQuestion({ playerId, attemptId: quiz.attemptId, questionId: q.id, chosenIndex: chosen });
      if (res.error) return setError(res.error);
      setError(null);
      setQuiz({ ...quiz, done: { ...quiz.done, [q.id]: Boolean(res.correct) } });
      setFeedback({ chosen, correct: Boolean(res.correct), correctIndex: res.correctIndex ?? -1, explanation: res.explanation ?? null });
    });
  }

  function nextQuestion() {
    if (!quiz) return;
    setFeedback(null);
    const next = quiz.questions.findIndex((q, i) => i > quiz.index && !(q.id in quiz.done));
    if (next >= 0) return setQuiz({ ...quiz, index: next });
    setQuiz({ ...quiz, index: quiz.questions.length });
    startTransition(async () => {
      const res = await finishIqLevel({ attemptId: quiz.attemptId });
      if (res.error) return setError(res.error);
      setResult({ correct: res.correct ?? 0, total: res.total ?? 0, passed: Boolean(res.passed), awardEarned: Boolean(res.awardEarned) });
      setMode("result");
    });
  }

  const heading = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">
          How to Keep the Book · Chapter {n} of {CHAPTER_COUNT}
        </p>
        <h2 className="mt-1 font-display text-3xl font-bold tracking-wide text-highlight uppercase">{chapter.title}</h2>
      </div>
      <Link href={iqHref} className="text-sm text-link hover:underline">
        ← Softball IQ
      </Link>
    </div>
  );
  const errorLine = error && (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  );

  // ---- quiz result ----------------------------------------------------------
  if (mode === "result" && result) {
    const pct = result.total ? Math.round((100 * result.correct) / result.total) : 0;
    return (
      <div className="flex flex-col gap-5">
        {heading}
        <div className={`rounded-xl border p-6 text-center ${result.passed ? "border-neon bg-neon/10" : "border-pink/60 bg-pink/5"}`}>
          <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">Chapter {n} quiz</p>
          {result.passed && (
            <div className="mt-4 flex justify-center">
              <ManagerAward name={plate.name} number={plate.number} year={new Date().getFullYear()} chapter={`Chapter ${n} · ${chapter.short}`} size={260} />
            </div>
          )}
          <p className="mt-3 text-4xl font-bold text-highlight tabular-nums">
            {result.correct}/{result.total} <span className="text-2xl text-muted">· {pct}%</span>
          </p>
          <p className="mt-2 text-sm">
            {result.passed
              ? result.awardEarned
                ? `Chapter ${n} complete. Manager of the Year earned${nextHref ? `, and Chapter ${n + 1} is open` : ". That's the whole course"}.`
                : "Passed again. This chapter's Manager of the Year is already on your shelf."
              : `${PASS_PCT}% earns Manager of the Year (${Math.ceil((result.total * PASS_PCT) / 100)} of ${result.total}). Read the explanations, then go again.`}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {result.passed && nextHref ? (
              <Link href={nextHref} className={buttonClass}>
                Chapter {n + 1} →
              </Link>
            ) : !result.passed ? (
              <button type="button" onClick={() => startQuiz()} disabled={pending} className={buttonClass}>
                Retake the quiz
              </button>
            ) : null}
            {!result.passed && (
              <button type="button" onClick={reread} className={secondaryButtonClass}>
                Read the chapter again
              </button>
            )}
            <Link href={iqHref} className={secondaryButtonClass}>
              Back to Softball IQ
            </Link>
          </div>
          {errorLine}
        </div>
      </div>
    );
  }

  // ---- a quiz question -------------------------------------------------------
  if (mode === "quiz" && quiz) {
    const q = quiz.questions[quiz.index];
    const answered = Object.keys(quiz.done).length;
    const visual = q && q.diagram && typeof q.diagram === "object" && "kind" in q.diagram ? (q.diagram as Visual) : null;
    return (
      <div className="flex flex-col gap-5">
        {heading}
        <div className={`${cardClass("inset")} p-4 sm:p-6`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs tracking-widest text-pink-soft uppercase">Chapter {n} quiz</span>
            <button type="button" onClick={() => setMode("ready")} className={secondaryButtonClass}>
              Save &amp; exit
            </button>
          </div>
          <ProgressBar value={answered} max={quiz.questions.length} label={`${answered} of ${quiz.questions.length} answered · progress saved`} />
          {q ? (
            <div className={`mt-5 grid gap-5 ${visual ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
              {visual && <ScoreVisual visual={visual} />}
              <div>
                <p className="text-sm text-ink/80 italic">{q.scenario}</p>
                <p className="mt-2 text-lg font-semibold">{q.question}</p>
                <ol className="mt-4 grid gap-2">
                  {q.choices.map((choice, i) => {
                    const state = !feedback ? "idle" : i === feedback.correctIndex ? "right" : i === feedback.chosen && !feedback.correct ? "wrong" : "idle";
                    return (
                      <li key={i}>
                        <button type="button" disabled={Boolean(feedback) || pending || !canEdit} onClick={() => answer(i)} className={choiceClass(state)}>
                          <span className={`font-mono font-bold ${state === "right" ? "text-highlight" : state === "wrong" ? "text-pink-soft" : "text-muted"}`}>
                            {LETTERS[i]}
                          </span>
                          <span>{choice}</span>
                          {state === "right" && <span className="ml-auto font-bold text-highlight">✓</span>}
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {feedback && (
                  <div className="mt-4" aria-live="polite">
                    <p className={`font-bold ${feedback.correct ? "text-highlight" : "text-pink-soft"}`}>{feedback.correct ? "Correct." : "Not quite."}</p>
                    {feedback.explanation && <p className="mt-1 text-sm text-ink/90">{feedback.explanation}</p>}
                    <button type="button" onClick={nextQuestion} disabled={pending} className={`${buttonClass} mt-4`}>
                      {quiz.questions.some((x, i) => i > quiz.index && !(x.id in quiz.done)) ? "Next question" : pending ? "Grading…" : "Finish the quiz"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 text-center">
              <p className="text-sm">Every question is answered.</p>
              <button type="button" onClick={nextQuestion} disabled={pending} className={`${buttonClass} mt-3`}>
                {pending ? "Grading…" : "Finish the quiz"}
              </button>
            </div>
          )}
          <div className="mt-3">{errorLine}</div>
        </div>
      </div>
    );
  }

  // ---- quiz ready --------------------------------------------------------------
  if (mode === "ready") {
    return (
      <div className="flex flex-col gap-5">
        {heading}
        <div className={`${cardClass("inset")} flex flex-wrap items-center gap-6 p-6`}>
          <ManagerAward name={plate.name} earned={Boolean(earnedOn)} engrave={false} size={120} />
          <div className="min-w-56 flex-1">
            <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">Lessons done</p>
            <p className="mt-1 text-xl font-bold">Chapter {n} quiz</p>
            <p className="mt-1 text-sm text-muted">
              {QUIZ_LENGTH} questions on this chapter. Score {PASS_PCT}% or better ({Math.ceil((QUIZ_LENGTH * PASS_PCT) / 100)} of {QUIZ_LENGTH}) to
              earn Manager of the Year. Your answers save as you go.
            </p>
            {best && <p className="mt-1 text-xs text-muted">Best so far: {best.correct}/{best.total}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => startQuiz()} disabled={!canEdit || pending} className={buttonClass}>
                {quizOpen ? "Resume the quiz" : earnedOn ? "Retake the quiz" : "Start the quiz"}
              </button>
              {quizOpen && (
                <button
                  type="button"
                  onClick={async () => (await confirmAction("Start the quiz over? The saved answers will be cleared.")) && startQuiz(true)}
                  disabled={!canEdit || pending}
                  className="text-xs text-muted underline hover:text-ink"
                >
                  Start over
                </button>
              )}
              <button type="button" onClick={reread} className="text-sm text-pink-soft underline">
                Read the chapter again
              </button>
            </div>
            {!canEdit && <p className="mt-2 text-xs text-muted">Viewers can read the lessons; the player or a coach takes the quiz.</p>}
          </div>
        </div>
        {errorLine}
      </div>
    );
  }

  // ---- a lesson step -----------------------------------------------------------
  const step = chapter.steps[index];
  return (
    <div className="flex flex-col gap-5">
      {heading}
      {earnedOn && (
        <div className="flex items-center gap-3 rounded-xl border border-neon/60 bg-neon/5 px-4 py-3">
          <ManagerAward name={plate.name} engrave={false} size={44} />
          <p className="text-sm">
            <span className="font-bold text-highlight">Chapter complete.</span> Manager of the Year earned {earnedOn}.
          </p>
        </div>
      )}
      <ProgressBar value={index + 1} max={chapter.steps.length} label={`Step ${index + 1} of ${chapter.steps.length}`} />
      <article key={index} className={`${cardClass("inset")} p-4 sm:p-6`}>
        <LessonStep step={step} />
      </article>
      <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Lesson steps">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={`${secondaryButtonClass} disabled:opacity-40`}>
          ← Back
        </button>
        {index < last ? (
          <button type="button" onClick={() => go(index + 1)} className={buttonClass}>
            Next →
          </button>
        ) : (
          <button type="button" onClick={finishLessons} disabled={pending} className={buttonClass}>
            {earnedOn || lessonsDone ? "Go to the quiz" : "Finish the chapter"}
          </button>
        )}
      </nav>
      {errorLine}
    </div>
  );
}
