"use client";

// Team Playbook: the call sheet as flashcards, and the team quiz runner.
import Link from "next/link";
import { useState, useTransition } from "react";
import { ProgressBar } from "@/components/progress-bar";
import { buttonClass, secondaryButtonClass } from "@/components/ui";
import { quizScore, shuffled } from "@/lib/playbook";
import { answerTeamQuiz } from "./playbook-actions";
import type { CallCard, QuizQuestion } from "./playbook-data";

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

type Deck = { pile: string[]; flipped: boolean; known: number; round: number };

const startDeck = (ids: string[], round: number): Deck => ({ pile: round === 0 ? ids : shuffled(ids, round * 7919), flipped: false, known: 0, round });
const flip = (d: Deck): Deck => ({ ...d, flipped: !d.flipped });
const gotIt = (d: Deck): Deck => ({ ...d, pile: d.pile.slice(1), flipped: false, known: d.known + 1 });
const again = (d: Deck): Deck => ({ ...d, pile: [...d.pile.slice(1), d.pile[0]], flipped: false });

export function Flashcards({ cards }: { cards: CallCard[] }) {
  const ids = cards.map((c) => c.id);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const [deck, setDeck] = useState<Deck>(() => startDeck(ids, 0));
  const card = deck.pile.length ? byId.get(deck.pile[0]) : undefined;

  if (!card) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-neon/60 bg-neon/5 p-8 text-center">
        <p className="font-display text-3xl font-bold text-highlight tabular-nums">
          {deck.known}/{cards.length}
        </p>
        <p className="text-sm text-ink">Deck done. Every call, cold.</p>
        <button type="button" onClick={() => setDeck(startDeck(ids, deck.round + 1))} className={buttonClass}>
          Shuffle and go again
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ProgressBar value={deck.known} max={cards.length} label={`${deck.known} of ${cards.length} down · ${deck.pile.length} in the pile`} />
      <button
        type="button"
        onClick={() => setDeck(flip)}
        aria-label={deck.flipped ? `What to do on ${card.name}. Tap to see the call` : `${card.name}. Tap to see what to do`}
        className={`flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center transition ${
          deck.flipped ? "border-pink bg-navy-900" : "border-navy-600 bg-navy-950/60 hover:border-pink"
        }`}
      >
        <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-pink-soft uppercase">{card.kind}</span>
        {deck.flipped ? (
          <span className="max-w-prose text-base whitespace-pre-line text-ink">{card.description}</span>
        ) : (
          <>
            <span className="font-display text-4xl font-bold tracking-wide text-highlight uppercase">{card.name}</span>
            {card.situation && <span className="text-sm text-muted">{card.situation}</span>}
            <span className="mt-2 font-mono text-[10px] tracking-wider text-muted uppercase">Tap to see what you do</span>
          </>
        )}
      </button>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={() => setDeck(again)} className={secondaryButtonClass}>
          Again
        </button>
        <button type="button" onClick={() => setDeck(gotIt)} className={buttonClass}>
          Got it
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team quiz
// ---------------------------------------------------------------------------

type Answer = { chosen: number; is_correct: boolean; first_correct: boolean; correct_index: number; explanation: string | null };

export function TeamQuizRunner({ playerId, quizId, questions, canAct }: { playerId: string; quizId: string; questions: QuizQuestion[]; canAct: boolean }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(
      questions
        .filter((q) => q.chosen_index !== null && q.correct_index !== null)
        .map((q) => [q.id, { chosen: q.chosen_index!, is_correct: !!q.is_correct, first_correct: !!q.first_correct, correct_index: q.correct_index!, explanation: q.explanation }]),
    ),
  );
  // the question on screen, and whether she has just answered it (showing the result)
  const firstOpen = () => questions.findIndex((q) => !answers[q.id]);
  const [view, setView] = useState<{ index: number; shown: boolean; fixing: boolean }>(() => ({ index: Math.max(0, firstOpen()), shown: false, fixing: false }));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const score = quizScore(questions.map((q) => (answers[q.id] ? answers[q.id] : { first_correct: null, is_correct: null })));
  const toFix = questions.filter((q) => answers[q.id] && !answers[q.id].is_correct).map((q) => q.id);
  const finished = score.done && !view.shown;

  function choose(q: QuizQuestion, i: number) {
    if (!canAct || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await answerTeamQuiz(playerId, q.id, i);
      if (res.error || res.is_correct === undefined) {
        setError(res.error ?? "Couldn't save your answer. Try again.");
        return;
      }
      setAnswers((a) => ({
        ...a,
        [q.id]: {
          chosen: i,
          is_correct: res.is_correct!,
          first_correct: a[q.id] ? a[q.id].first_correct : res.is_correct!,
          correct_index: res.correct_index!,
          explanation: res.explanation ?? null,
        },
      }));
      setView((v) => ({ ...v, shown: true }));
    });
  }

  function next() {
    const after = (from: number, pred: (id: string) => boolean) => {
      for (let k = 1; k <= questions.length; k++) {
        const idx = (from + k) % questions.length;
        if (pred(questions[idx].id)) return idx;
      }
      return -1;
    };
    const target = view.fixing ? after(view.index, (id) => !answers[id]?.is_correct) : after(view.index, (id) => !answers[id]);
    if (target === -1) setView({ index: view.index, shown: false, fixing: false });
    else setView({ index: target, shown: false, fixing: view.fixing });
  }

  if (finished && !view.fixing) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-neon/60 bg-neon/5 p-6 text-center">
          <p className="font-mono text-xs tracking-[0.2em] text-pink-soft uppercase">First try</p>
          <p className="mt-1 font-display text-5xl font-bold text-highlight tabular-nums">
            {score.firstTry}/{score.total}
          </p>
          <p className="mt-2 text-sm text-ink">{score.pct >= 80 ? "You know the calls." : "Run the flashcards, then fix the ones you missed."}</p>
        </div>
        {toFix.length > 0 && canAct && (
          <button
            type="button"
            onClick={() => setView({ index: questions.findIndex((q) => q.id === toFix[0]), shown: false, fixing: true })}
            className={buttonClass}
          >
            Fix the {toFix.length} you missed
          </button>
        )}
        <Link href={`/players/${playerId}/iq/playbook`} className="text-center text-sm text-pink hover:underline">
          ← Team Playbook
        </Link>
      </div>
    );
  }

  const q = questions[view.index];
  const a = answers[q.id];
  const reveal = view.shown && a;
  const locked = !canAct || pending || (a && !view.fixing && !view.shown) || reveal;
  return (
    <div className="flex flex-col gap-5" data-quiz={quizId}>
      <ProgressBar value={score.answered} max={score.total} label={view.fixing ? `Fixing misses · ${toFix.length} left` : `Question ${view.index + 1} of ${score.total}`} />
      <p className="text-lg font-semibold text-ink">{q.question}</p>
      <ul className="flex flex-col gap-2">
        {q.choices.map((c, i) => {
          const isRight = reveal && i === a.correct_index;
          const isWrongPick = reveal && i === a.chosen && !a.is_correct;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!!locked}
                onClick={() => choose(q, i)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                  isRight
                    ? "border-neon bg-neon/15 font-semibold text-ink"
                    : isWrongPick
                      ? "border-danger bg-danger/10 text-ink"
                      : "border-navy-600 bg-navy-950/40 enabled:hover:border-pink"
                }`}
              >
                {c}
              </button>
            </li>
          );
        })}
      </ul>
      {reveal && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${a.is_correct ? "border-neon/60 text-ink" : "border-pink/60 text-ink"}`}>
          <p className="font-semibold">{a.is_correct ? "Right." : "Not this time."}</p>
          {a.explanation && <p className="mt-1 text-muted">{a.explanation}</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {reveal && (
        <button type="button" onClick={next} className={`${buttonClass} self-start`}>
          {score.done && (!view.fixing || toFix.length === 0) ? "See my score" : "Next"}
        </button>
      )}
      {!canAct && <p className="text-xs text-muted">View only.</p>}
    </div>
  );
}
