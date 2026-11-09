"use client";

// A G3 chapter's course (Mental Toughness): step-through lessons with quick checks
// and things to try. The server page passes this one chapter's steps as props
// (paid content stays out of every other page); her furthest step is saved as she
// goes, and finishing the course unlocks "Mark chapter complete".
import { useState, useTransition } from "react";
import { buttonClass, secondaryButtonClass, eyebrowClass } from "@/components/ui";
import { ProgressBar } from "@/components/progress-bar";
import type { CourseStep } from "@/lib/advanced-book";
import { finishCourse, saveCourseStep } from "./advanced-actions";

const LETTERS = ["A", "B", "C", "D"];

function QuickCheck({ check }: { check: NonNullable<CourseStep["check"]> }) {
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
              <button
                type="button"
                disabled={chosen !== null}
                onClick={() => setChosen(i)}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${
                  state === "right" ? "border-neon bg-neon/15" : state === "wrong" ? "border-pink bg-pink/15" : "border-navy-600 hover:border-pink disabled:hover:border-navy-600"
                }`}
              >
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

export function CourseRunner({
  playerId,
  chapter,
  steps,
  lessons,
  initialStep,
  done,
  canEdit,
}: {
  playerId: string;
  chapter: string;
  steps: CourseStep[];
  lessons: { name: string; start: number; count: number }[];
  initialStep: number;
  done: boolean;
  canEdit: boolean;
}) {
  const last = steps.length - 1;
  const [index, setIndex] = useState(done ? 0 : Math.min(initialStep, last));
  const [furthest, setFurthest] = useState(done ? last : Math.min(initialStep, last));
  const [finished, setFinished] = useState(done);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const step = steps[index];
  const lessonNo = lessons.findIndex((l) => index >= l.start && index < l.start + l.count);

  function go(to: number) {
    setIndex(to);
    document.getElementById("course")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (to > furthest) {
      setFurthest(to);
      if (canEdit) startTransition(async () => void (await saveCourseStep({ playerId, chapter, step: to })));
    }
  }

  function finish() {
    setError(null);
    if (!canEdit) return setFinished(true);
    startTransition(async () => {
      const res = await finishCourse({ playerId, chapter });
      if (res.error) return setError(res.error);
      setFinished(true);
    });
  }

  return (
    <div id="course" className="scroll-mt-24 rounded-2xl border border-navy-600 bg-navy-900/70 p-5 sm:p-7">
      <ProgressBar
        value={finished ? steps.length : furthest + 1}
        max={steps.length}
        label={finished ? "Course complete" : `Lesson ${lessonNo + 1} of ${lessons.length} · ${lessons[lessonNo]?.name ?? ""}`}
      />

      <nav aria-label="Lessons" className="mt-4 flex flex-wrap gap-1.5">
        {lessons.map((l, i) => {
          const open = finished || l.start <= furthest;
          return (
            <button
              key={l.name}
              type="button"
              disabled={!open}
              onClick={() => go(l.start)}
              aria-current={i === lessonNo ? "step" : undefined}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                i === lessonNo ? "border-pink bg-pink text-on-accent" : open ? "border-navy-600 text-ink hover:border-pink" : "border-dashed border-navy-700 text-muted"
              }`}
            >
              {l.name}
            </button>
          );
        })}
      </nav>

      <article className="mt-6">
        <p className={eyebrowClass}>
          {step.lesson} · {index + 1} / {steps.length}
        </p>
        <h3 className="mt-1 font-display text-2xl font-bold tracking-wide text-highlight uppercase">{step.title}</h3>
        {step.body.map((p, i) => (
          <p key={i} className="mt-3 max-w-prose text-ink/90">
            {p}
          </p>
        ))}
        {step.tryIt && (
          <p className="mt-5 max-w-3xl rounded-xl border border-neon/60 bg-neon/5 p-4 text-sm">
            <span className="mr-2 font-mono text-2xs font-bold tracking-widest text-highlight uppercase">Try it</span>
            {step.tryIt}
          </p>
        )}
        {step.check && <QuickCheck key={index} check={step.check} />}
      </article>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-navy-700 pt-4">
        {index > 0 ? (
          <button type="button" onClick={() => go(index - 1)} className={secondaryButtonClass}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        {index < last ? (
          <button type="button" onClick={() => go(index + 1)} className={buttonClass}>
            Next →
          </button>
        ) : finished ? (
          <span className="rounded-full border border-neon bg-neon/10 px-3 py-1 text-sm font-semibold text-highlight">Course complete ✓</span>
        ) : (
          <button type="button" disabled={pending} onClick={finish} className={buttonClass}>
            {pending ? "Saving…" : "Finish the course"}
          </button>
        )}
      </div>
      {finished && index === last && (
        <p className="mt-3 text-sm text-muted">Now go through the foundation below: mark the habits you own and add your own.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
