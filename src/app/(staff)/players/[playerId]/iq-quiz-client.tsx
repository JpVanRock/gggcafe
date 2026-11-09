"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, buttonClass, inputClass, secondaryButtonClass, cardClass } from "@/components/ui";
import { initialFormState } from "@/lib/form";
import { POSITIONS, POSITION_LABEL } from "@/lib/softball";

import { answerIqQuestion, saveIqQuestion } from "./iq-actions";
import type { IqQuestion } from "./data";

import { LETTERS, plural, type Feedback } from "./iq-shared";
import { SubmitButton } from "@/components/submit-button";

// Softball IQ practice: the quiz runner and the question bank form (coaches).
export type QuizQuestion = Pick<IqQuestion, "id" | "scenario" | "question" | "choices">;
export type QuizInfo = {
  key: string;
  label: string;
  questions: QuizQuestion[]; // already ordered: new first, then missed, then mastered
  stats: { answered: number; pct: number | null; mastered: number; total: number };
};

const QUIZ_LENGTH = 10;

export function QuizRunner({ playerId, quizzes, canEdit }: { playerId: string; quizzes: QuizInfo[]; canEdit: boolean }) {
  const [run, setRun] = useState<{ label: string; questions: QuizQuestion[] } | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!run) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {quizzes.map((quiz) => (
          <div key={quiz.key} className={`${cardClass("inset")} flex flex-col justify-between gap-3 p-4`}>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-bold tracking-wide uppercase">{quiz.label}</p>
                <p className="font-mono text-lg font-bold text-highlight">{quiz.stats.pct === null ? "New" : `${quiz.stats.pct}%`}</p>
              </div>
              <p className="mt-1 text-xs text-muted">
                {quiz.stats.mastered}/{quiz.stats.total} mastered · {quiz.stats.answered} answered
              </p>
            </div>
            <button
              type="button"
              disabled={!canEdit || quiz.questions.length === 0}
              onClick={() => {
                setRun({ label: quiz.label, questions: quiz.questions.slice(0, QUIZ_LENGTH) });
                setIndex(0);
                setScore(0);
                setFeedback(null);
                setError(null);
              }}
              className={buttonClass}
            >
              {quiz.questions.length === 0 ? "No questions yet" : `Start · ${plural(Math.min(quiz.questions.length, QUIZ_LENGTH), "question", "questions")}`}
            </button>
          </div>
        ))}
        {!canEdit && <p className="text-xs text-muted sm:col-span-2">Viewers can see results; a coach runs the quiz with the player.</p>}
      </div>
    );
  }

  const done = index >= run.questions.length;
  if (done) {
    return (
      <div className="rounded-xl border border-neon bg-neon/10 p-6 text-center">
        <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">{run.label}</p>
        <p className="mt-2 text-4xl font-bold text-highlight">
          {score}/{run.questions.length}
        </p>
        <p className="mt-1 text-sm text-muted">
          {score === run.questions.length ? "Perfect score." : "Missed questions come up first next time."}
        </p>
        <button type="button" onClick={() => setRun(null)} className={`${buttonClass} mt-5`}>
          Back to quizzes
        </button>
      </div>
    );
  }

  const q = run.questions[index];
  function choose(chosen: number) {
    startTransition(async () => {
      const result = await answerIqQuestion({ playerId, questionId: q.id, chosenIndex: chosen });
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      if (result.correct) setScore((s) => s + 1);
      setFeedback({ chosen, correct: Boolean(result.correct), correctIndex: result.correctIndex ?? -1, explanation: result.explanation ?? null });
    });
  }

  return (
    <div className={`${cardClass("inset")} p-4 sm:p-6`}>
      <div className="flex items-center justify-between gap-3 font-mono text-xs tracking-widest text-muted uppercase">
        <span className="text-pink-soft">{run.label}</span>
        <span>
          Question {index + 1} of {run.questions.length} · {score} right
        </span>
      </div>
      <p className="mt-4 text-sm text-ink/80 italic">{q.scenario}</p>
      <p className="mt-2 text-lg font-semibold">{q.question}</p>

      <ol className="mt-4 grid gap-2">
        {q.choices.map((choice, i) => {
          const isCorrect = feedback && i === feedback.correctIndex;
          const isWrongPick = feedback && i === feedback.chosen && !feedback.correct;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={Boolean(feedback) || pending}
                onClick={() => choose(i)}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${
                  isCorrect
                    ? "border-neon bg-neon/15 text-ink"
                    : isWrongPick
                      ? "border-pink bg-pink/15 text-ink"
                      : "border-navy-600 hover:border-pink disabled:hover:border-navy-600"
                }`}
              >
                <span className={`font-mono font-bold ${isCorrect ? "text-highlight" : isWrongPick ? "text-pink-soft" : "text-muted"}`}>
                  {LETTERS[i]}
                </span>
                <span>{choice}</span>
                {isCorrect && <span className="ml-auto font-bold text-highlight">✓</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {feedback && (
        <div className="mt-4" aria-live="polite">
          <p className={`font-bold ${feedback.correct ? "text-highlight" : "text-pink-soft"}`}>{feedback.correct ? "Correct!" : "Not quite."}</p>
          {feedback.explanation && <p className="mt-1 text-base text-ink/90">{feedback.explanation}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setIndex((i) => i + 1);
              }}
              className={buttonClass}
            >
              {index + 1 < run.questions.length ? "Next question" : "See score"}
            </button>
            <button type="button" onClick={() => setRun(null)} className={secondaryButtonClass}>
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IqQuestionForm({ question }: { question?: IqQuestion }) {
  const [state, action] = useActionState(saveIqQuestion, initialFormState);
  const [topic, setTopic] = useState<IqQuestion["topic"]>(question?.topic ?? "general");

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {question && <input type="hidden" name="id" value={question.id} />}
      <Field label="Section">
        <select name="topic" value={topic} onChange={(e) => setTopic(e.target.value as IqQuestion["topic"])} className={inputClass}>
          <option value="general">General IQ</option>
          <option value="hitting">Hitting IQ</option>
          <option value="pitching">Pitching IQ</option>
          <option value="position">A specific position</option>
        </select>
      </Field>
      {topic === "position" ? (
        <Field label="Position">
          <select name="position" required defaultValue={question?.position ?? ""} className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {POSITIONS.filter((p) => !["DP", "FLEX", "EH"].includes(p)).map((p) => (
              <option key={p} value={p}>
                {POSITION_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Difficulty">
          <select name="difficulty" defaultValue={String(question?.difficulty ?? 1)} className={inputClass}>
            <option value="1">Rookie</option>
            <option value="2">Varsity</option>
            <option value="3">All-American</option>
          </select>
        </Field>
      )}
      <div className="sm:col-span-2">
        <Field label="Game situation">
          <textarea
            name="scenario"
            required
            rows={2}
            defaultValue={question?.scenario ?? ""}
            placeholder="Runner on first, one out, 2-1 count…"
            className={inputClass}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Question">
          <input name="question" required defaultValue={question?.question ?? ""} placeholder="What do you do?" className={inputClass} />
        </Field>
      </div>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Choices: mark the correct one</legend>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              value={i}
              defaultChecked={question ? question.correct_index === i : i === 0}
              aria-label={`Choice ${LETTERS[i]} is correct`}
              className="size-4 accent-pink"
            />
            <span className="w-4 font-mono text-sm text-muted">{LETTERS[i]}</span>
            <input
              name={`choice_${i}`}
              required={i < 2}
              defaultValue={question?.choices[i] ?? ""}
              aria-label={`Choice ${LETTERS[i]}`}
              className={`${inputClass} py-1.5`}
            />
          </div>
        ))}
      </fieldset>
      <div className="sm:col-span-2">
        <Field label="Why it's right" hint="Shown after the player answers">
          <textarea name="explanation" rows={2} defaultValue={question?.explanation ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton>{question ? "Save question" : "Add question"}</SubmitButton>
        <FormMessage error={state.error} saved={state.saved} fields={state.fields} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tests with saved progress and review: playbook levels (Defense IQ and
// Baserunning IQ, championship rings) and position tests (Golden Gloves)
