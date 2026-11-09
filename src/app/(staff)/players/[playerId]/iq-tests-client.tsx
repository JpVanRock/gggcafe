"use client";

import { useState, useTransition } from "react";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";

import { POSITION_LABEL, type FieldPosition } from "@/lib/softball";
import { Diamond, type DiamondSpec } from "@/components/diamond";
import { Ring, TRACK_LABEL, type RingTrack } from "@/components/rings";
import { GoldenGlove } from "@/components/golden-glove";
import { MvpBadge } from "@/components/mvp-badge";
import { BADGE_TRACK_LABEL, isBadgeTrack, type BadgeTrack } from "@/lib/iq-tracks";
import { ChampionsTrophy } from "@/components/champions-trophy";
import { StolenBasePlaque } from "@/components/stolen-base-plaque";
import { DetailHeading } from "./menu";
import { ProgressBar } from "@/components/progress-bar";
import { useRouter } from "next/navigation";
import { answerIqLevelQuestion, answerIqReviewQuestion, finishIqLevel, getIqHint, startIqLevel, startIqReview, type LevelQuestion } from "./iq-actions";

import { LETTERS, plural, type Feedback } from "./iq-shared";

// ---------------------------------------------------------------------------

/** Where a player stands on one test (a playbook level or a position). */
type TestState = {
  questionCount: number;
  best: { correct: number; total: number } | null;
  /** an unfinished test she can resume */
  inProgress: { answered: number; total: number } | null;
  /** the most recent finished test, for reviewing what she missed */
  lastFinished: { attemptId: string; missed: number; reviewed: number; reviewedAt: string | null } | null;
};
export type LevelInfo = TestState & {
  level: number;
  status: "earned" | "open" | "locked";
  earnedOn: string | null;
};
export type TrackInfo = { track: RingTrack; label: string; blurb: string; levels: LevelInfo[] };
/** Offense IQ and Battery IQ: Levels 1-3, passing unlocks the next; the award is the MVP badge (no ring). */
export type BadgeTrackInfo = { track: BadgeTrack; label: string; blurb: string; levels: (LevelInfo & { mvp: boolean })[] };
export type PositionInfo = TestState & {
  position: FieldPosition;
  label: string;
  /** one of the positions she plays; primary = her main position */
  mine: boolean;
  primary: boolean;
  /** Golden Glove earned on (formatted), or null */
  earnedOn: string | null;
  earnedYear: string | null;
};
/** The Extra Credit Library: one run covers every library question, grouped on shelves. */
export type LibraryInfo = TestState & {
  shelves: { name: string; count: number }[];
  trophyEarnedOn: string | null;
};
/** What's engraved on her awards. */
export type Nameplate = { name: string; number: string | null };

const PASS_PCT = 80;
const LEVEL_NAME = ["", "Rookie", "Varsity", "All-American"];

type TestKey = { track: RingTrack | BadgeTrack | "position" | "extra"; level: number; position: FieldPosition | null };
type Answered = Record<string, { correct: boolean }>;
type TestResult = { correct: number; total: number; passed: boolean; awardEarned: boolean };
type Session = TestKey & {
  mode: "test" | "review";
  attemptId: string;
  questions: LevelQuestion[];
  done: Answered;
  index: number;
  /** Extra Credit: the shelf she's working through (null = any) */
  shelf: string | null;
};

function testName(k: TestKey) {
  if (k.track === "position") return `${POSITION_LABEL[k.position!]} IQ`;
  if (k.track === "extra") return "Extra Credit Library";
  if (isBadgeTrack(k.track)) return `${BADGE_TRACK_LABEL[k.track]} · Level ${k.level}`;
  return `${TRACK_LABEL[k.track]} · Level ${k.level}`;
}

/** Short label for the MVP badge earned on a test. */
function mvpLabel(k: TestKey) {
  if (k.track === "position") return `${k.position} · Golden Glove`;
  if (k.track === "extra") return "Extra Credit";
  if (isBadgeTrack(k.track)) return `${k.track === "offense" ? "Offense" : "Battery"} · L${k.level}`;
  return `${k.track === "defense" ? "Defense" : "Baserunning"} · L${k.level}`;
}

function needed(total: number) {
  return Math.ceil((total * PASS_PCT) / 100);
}

/** Next unanswered question from `from` (wrapping), on one shelf if given, else anywhere. */
function nextOpen(questions: LevelQuestion[], done: Answered, from: number, shelf: string | null = null): number {
  const open = (q: LevelQuestion) => !done[q.id] && (!shelf || q.section === shelf);
  for (let i = from; i < questions.length; i++) if (open(questions[i])) return i;
  for (let i = 0; i < from; i++) if (open(questions[i])) return i;
  return shelf ? nextOpen(questions, done, from) : questions.length; // shelf done: carry on anywhere
}

function shelvesOf(questions: LevelQuestion[], done: Answered) {
  const map = new Map<string, { name: string; count: number; answered: number }>();
  for (const q of questions) {
    const name = q.section ?? "Library";
    const s = map.get(name) ?? { name, count: 0, answered: 0 };
    s.count += 1;
    if (done[q.id]) s.answered += 1;
    map.set(name, s);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

type Actions = {
  canEdit: boolean;
  pending: boolean;
  start: (key: TestKey, restart?: boolean) => void;
  review: (key: TestKey, attemptId: string) => void;
};

/** Resume / start over for an unfinished test, and "review missed" for the last finished one. */
function TestFollowUps({ test, testKey, actions }: { test: TestState; testKey: TestKey; actions: Actions }) {
  const { canEdit, pending, start, review } = actions;
  const toReview = test.lastFinished && test.lastFinished.missed > 0 ? test.lastFinished : null;
  return (
    <>
      {test.inProgress && (
        <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-navy-700 pt-2.5">
          <div className="min-w-40 flex-1">
            <ProgressBar value={test.inProgress.answered} max={test.inProgress.total} label={`${test.inProgress.answered} of ${test.inProgress.total} answered`} />
          </div>
          <button type="button" disabled={!canEdit || pending} onClick={() => start(testKey)} className={buttonClass}>
            Resume
          </button>
          <button
            type="button"
            disabled={!canEdit || pending}
            onClick={() => start(testKey, true)}
            className="text-xs text-muted underline hover:text-ink"
          >
            Start over
          </button>
        </div>
      )}
      {toReview && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-navy-700 pt-2.5">
          <p className="text-xs text-muted">
            {toReview.reviewedAt
              ? `Last test's ${plural(toReview.missed, "miss", "misses")} reviewed ✓`
              : `Last test: ${toReview.missed} missed${toReview.reviewed ? ` · ${toReview.reviewed} reviewed` : ""}`}
          </p>
          {!toReview.reviewedAt && (
            <button type="button" disabled={!canEdit || pending} onClick={() => review(testKey, toReview.attemptId)} className={secondaryButtonClass}>
              {toReview.reviewed ? "Continue review" : `Review missed (${toReview.missed})`}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function BadgeTrackPicker({ tracks, actions }: { tracks: BadgeTrackInfo[]; actions: Actions }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tracks.map((t) => (
        <section key={t.track} className="rounded-xl border border-navy-700 bg-navy-950/40 p-4">
          <h4 className="text-lg font-bold tracking-wide uppercase">{t.label}</h4>
          <p className="mt-0.5 text-xs text-muted">{t.blurb}</p>
          <ul className="mt-4 grid gap-2">
            {t.levels.map((l) => {
              const key: TestKey = { track: t.track, level: l.level, position: null };
              const open = l.status !== "locked";
              return (
                <li key={l.level} className="rounded-lg border border-navy-700 p-2.5">
                  <div className="flex items-center gap-3">
                    <MvpBadge label={`${t.track === "offense" ? "Offense" : "Battery"} · L${l.level}`} earned={l.mvp} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        Level {l.level}
                        <span className="ml-2 font-mono text-[11px] font-normal tracking-wider text-muted uppercase">
                          {LEVEL_NAME[l.level]} · {l.questionCount} questions
                        </span>
                      </p>
                      <p className="text-xs text-muted">
                        {l.status === "locked"
                          ? `Pass Level ${l.level - 1} with ${PASS_PCT}%+ to unlock`
                          : l.mvp
                            ? `MVP badge earned${l.status === "earned" ? ` · passed ${l.earnedOn ?? ""}` : ""}`
                            : l.status === "earned"
                              ? `Passed ${l.earnedOn ?? ""}. A perfect score or reviewing every miss earns the MVP badge.`
                              : l.best
                                ? `Best ${l.best.correct}/${l.best.total}. Needs ${PASS_PCT}%.`
                                : `Score ${PASS_PCT}% to pass; a perfect score earns the MVP badge`}
                      </p>
                    </div>
                    {open && !l.inProgress && (
                      <button
                        type="button"
                        disabled={!actions.canEdit || actions.pending || l.questionCount === 0}
                        onClick={() => actions.start(key)}
                        className={l.status === "earned" ? secondaryButtonClass : buttonClass}
                      >
                        {l.status === "earned" ? "Retake" : "Start"}
                      </button>
                    )}
                  </div>
                  {open && <TestFollowUps test={l} testKey={key} actions={actions} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TrackPicker({ tracks, actions }: { tracks: TrackInfo[]; actions: Actions }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tracks.map((t) => (
        <section key={t.track} className="rounded-xl border border-navy-700 bg-navy-950/40 p-4">
          <h4 className="text-lg font-bold tracking-wide uppercase">{t.label}</h4>
          <p className="mt-0.5 text-xs text-muted">{t.blurb}</p>
          <ul className="mt-4 grid gap-2">
            {t.levels.map((l) => {
              const key: TestKey = { track: t.track, level: l.level, position: null };
              const open = l.status !== "locked";
              return (
                <li key={l.level} className="rounded-lg border border-navy-700 p-2.5">
                  <div className="flex items-center gap-3">
                    <Ring track={t.track} level={l.level} earned={l.status === "earned"} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        Level {l.level}
                        <span className="ml-2 font-mono text-[11px] font-normal tracking-wider text-muted uppercase">
                          {LEVEL_NAME[l.level]} · {l.questionCount} questions
                        </span>
                      </p>
                      <p className="text-xs text-muted">
                        {l.status === "earned"
                          ? `Ring earned ${l.earnedOn ?? ""}`
                          : l.status === "locked"
                            ? `Pass Level ${l.level - 1} with ${PASS_PCT}%+ to unlock`
                            : l.best
                              ? `Best ${l.best.correct}/${l.best.total}. Needs ${PASS_PCT}%.`
                              : `Score ${PASS_PCT}% or better to earn the ring`}
                      </p>
                    </div>
                    {open && !l.inProgress && (
                      <button
                        type="button"
                        disabled={!actions.canEdit || actions.pending || l.questionCount === 0}
                        onClick={() => actions.start(key)}
                        className={l.status === "earned" ? secondaryButtonClass : buttonClass}
                      >
                        {l.status === "earned" ? "Retake" : "Start"}
                      </button>
                    )}
                  </div>
                  {open && <TestFollowUps test={l} testKey={key} actions={actions} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PositionPicker({ positions, plate, actions }: { positions: PositionInfo[]; plate: Nameplate; actions: Actions }) {
  const firstMine = positions.find((p) => p.primary) ?? positions.find((p) => p.mine) ?? positions[0];
  const [selected, setSelected] = useState<FieldPosition>(firstMine.position);
  const p = positions.find((x) => x.position === selected) ?? firstMine;
  const key: TestKey = { track: "position", level: 1, position: p.position };
  const earned = positions.filter((x) => x.earnedOn);
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-950/40 p-4">
      <p className="text-sm text-muted">
        Pick a position: {p.questionCount || 21} questions on that position&apos;s job in every situation. Score {PASS_PCT}% or better
        {p.questionCount ? ` (${needed(p.questionCount)} of ${p.questionCount})` : ""} to earn the Golden Glove.
      </p>
      <label className="mt-4 block max-w-sm">
        <span className="font-mono text-[11px] tracking-wider text-muted uppercase">Position</span>
        <select value={selected} onChange={(e) => setSelected(e.target.value as FieldPosition)} className={`${inputClass} mt-1`}>
          {positions.map((x) => (
            <option key={x.position} value={x.position}>
              {x.label}
              {x.mine ? " · her position" : ""}
              {x.earnedOn ? " · Golden Glove ✓" : x.inProgress ? ` · ${x.inProgress.answered}/${x.inProgress.total} saved` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 rounded-lg border border-navy-700 p-3">
        <div className="flex flex-wrap items-center gap-4">
          <GoldenGlove name={plate.name} number={plate.number} position={p.label} earned={Boolean(p.earnedOn)} engrave={false} size={120} />
          <div className="min-w-48 flex-1">
            <p className="text-lg font-bold tracking-wide uppercase">{p.label} IQ</p>
            <p className="text-xs text-muted">
              {p.earnedOn
                ? `Golden Glove earned ${p.earnedOn}`
                : p.questionCount === 0
                  ? "Questions for this position are coming."
                  : p.best
                    ? `Best ${p.best.correct}/${p.best.total}. Needs ${PASS_PCT}%.`
                    : `${p.questionCount} questions · one level`}
            </p>
          </div>
          {!p.inProgress && (
            <button
              type="button"
              disabled={!actions.canEdit || actions.pending || p.questionCount === 0}
              onClick={() => actions.start(key)}
              className={p.earnedOn ? secondaryButtonClass : buttonClass}
            >
              {p.earnedOn ? "Retake" : "Start"}
            </button>
          )}
        </div>
        <TestFollowUps test={p} testKey={key} actions={actions} />
      </div>

      {earned.length > 0 && (
        <p className="mt-3 font-mono text-[11px] tracking-wider text-muted uppercase">
          Golden Gloves: {earned.map((x) => x.label).join(" · ")}
        </p>
      )}
    </div>
  );
}

function LibraryPicker({ library, actions }: { library: LibraryInfo; actions: Actions }) {
  const key: TestKey = { track: "extra", level: 1, position: null };
  const total = library.questionCount;
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-950/40 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <ChampionsTrophy earned={Boolean(library.trophyEarnedOn)} size={110} />
        <div className="min-w-56 flex-1">
          <p className="text-sm text-muted">
            {total
              ? `${total} questions on the playbook topics the tests don't cover, on ${library.shelves.length} shelves. Work through them in any order, as many at a time as you like, with a hint whenever you want one. Answer every question in a run with ${PASS_PCT}% or better (${needed(total)} of ${total}) to earn the GGG Champions Trophy.`
              : "The library's questions are on their way."}
          </p>
          <p className="mt-2 text-xs text-muted">
            {library.trophyEarnedOn
              ? `GGG Champions Trophy earned ${library.trophyEarnedOn}`
              : library.best
                ? `Best run ${library.best.correct}/${library.best.total}. Needs ${PASS_PCT}%.`
                : "No runs yet."}
          </p>
        </div>
        {!library.inProgress && (
          <button
            type="button"
            disabled={!actions.canEdit || actions.pending || total === 0}
            onClick={() => actions.start(key)}
            className={library.trophyEarnedOn ? secondaryButtonClass : buttonClass}
          >
            {library.trophyEarnedOn ? "New run" : "Open the library"}
          </button>
        )}
      </div>
      {library.shelves.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {library.shelves.map((s) => (
            <li key={s.name} className="rounded-full border border-navy-600 px-3 py-1 font-mono text-[11px] tracking-wider text-muted uppercase">
              {s.name} · {s.count}
            </li>
          ))}
        </ul>
      )}
      <TestFollowUps test={library} testKey={key} actions={actions} />
    </div>
  );
}

export function IqTests({
  playerId,
  tracks,
  badgeTracks = [],
  positions,
  library,
  plate,
  canEdit,
  course,
}: {
  playerId: string;
  tracks: TrackInfo[];
  /** Offense IQ (and Battery IQ): MVP-badge tracks */
  badgeTracks?: BadgeTrackInfo[];
  positions: PositionInfo[];
  library: LibraryInfo;
  plate: Nameplate;
  canEdit: boolean;
  /** How to Keep the Book, shown above the Extra Credit Library */
  course?: React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [reviewDone, setReviewDone] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function exit() {
    setSession(null);
    setFeedback(null);
    setResult(null);
    setReviewDone(false);
    setHint(null);
    router.refresh();
  }

  function start(key: TestKey, restart = false) {
    if (restart && !window.confirm(`Start ${testName(key)} over? The saved answers in the unfinished test will be cleared.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await startIqLevel({ playerId, track: key.track, level: key.level, position: key.position, restart });
      if (res.error || !res.attemptId || !res.questions) return setError(res.error ?? "Couldn't start the test.");
      const done = res.answered ?? {};
      setSession({ ...key, mode: "test", attemptId: res.attemptId, questions: res.questions, done, index: nextOpen(res.questions, done, 0), shelf: null });
      setFeedback(null);
      setResult(null);
    });
  }

  function review(key: TestKey, attemptId: string) {
    setError(null);
    startTransition(async () => {
      const res = await startIqReview({ playerId, attemptId });
      if (res.error || !res.questions) return setError(res.error ?? "Couldn't open the review.");
      const done = res.reviewed ?? {};
      const index = nextOpen(res.questions, done, 0);
      setSession({ ...key, mode: "review", attemptId, questions: res.questions, done, index, shelf: null });
      setReviewDone(index >= res.questions.length);
      setFeedback(null);
      setHint(null);
    });
  }

  function answer(chosen: number) {
    if (!session) return;
    const q = session.questions[session.index];
    startTransition(async () => {
      const res =
        session.mode === "test"
          ? await answerIqLevelQuestion({
              playerId,
              attemptId: session.attemptId,
              questionId: q.id,
              chosenIndex: chosen,
              hintUsed: hint !== null,
            })
          : await answerIqReviewQuestion({
              playerId,
              attemptId: session.attemptId,
              questionId: q.id,
              chosenIndex: chosen,
              hintUsed: hint !== null,
            });
      if (res.error) return setError(res.error);
      setError(null);
      setSession({ ...session, done: { ...session.done, [q.id]: { correct: Boolean(res.correct) } } });
      setFeedback({ chosen, correct: Boolean(res.correct), correctIndex: res.correctIndex ?? -1, explanation: res.explanation ?? null });
    });
  }

  function next() {
    if (!session) return;
    setFeedback(null);
    setHint(null);
    const index = nextOpen(session.questions, session.done, session.index + 1, session.shelf);
    const shelf = session.shelf && session.questions[index]?.section === session.shelf ? session.shelf : null;
    setSession({ ...session, index, shelf });
    if (index < session.questions.length) return;
    if (session.mode === "review") return setReviewDone(true);
    startTransition(async () => {
      const res = await finishIqLevel({ attemptId: session.attemptId });
      if (res.error) return setError(res.error);
      setResult({ correct: res.correct ?? 0, total: res.total ?? 0, passed: Boolean(res.passed), awardEarned: Boolean(res.awardEarned) });
    });
  }

  function showHint() {
    if (!session) return;
    const q = session.questions[session.index];
    startTransition(async () => {
      const res = await getIqHint({ questionId: q.id });
      if (res.error) return setError(res.error);
      setHint(res.hint ?? "");
    });
  }

  function pickShelf(name: string | null) {
    if (!session || feedback) return;
    setHint(null);
    setSession({ ...session, shelf: name, index: nextOpen(session.questions, session.done, 0, name) });
  }

  const actions: Actions = { canEdit, pending, start, review };

  // ---- test result ----------------------------------------------------------
  if (session?.mode === "test" && result) {
    const pct = result.total ? Math.round((100 * result.correct) / result.total) : 0;
    const missed = result.total - result.correct;
    const position = session.track === "position" ? POSITION_LABEL[session.position!] : null;
    const extra = session.track === "extra";
    const badge = isBadgeTrack(session.track);
    const award = position ? "Golden Glove" : extra ? "GGG Champions Trophy" : "championship ring";
    const perfect = result.total > 0 && result.correct === result.total;
    return (
      <div className={`rounded-xl border p-6 text-center ${result.passed ? "border-neon bg-neon/10" : "border-pink/60 bg-pink/5"}`}>
        <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">{testName(session)}</p>
        {result.passed && !badge && (
          <div className="mt-4 flex justify-center">
            {position ? (
              <GoldenGlove name={plate.name} number={plate.number} position={position} year={new Date().getFullYear()} size={300} />
            ) : extra ? (
              <ChampionsTrophy size={240} />
            ) : (
              <Ring track={session.track as RingTrack} level={session.level} earned size={150} />
            )}
          </div>
        )}
        {result.passed && result.awardEarned && session.track === "baserunning" && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <StolenBasePlaque name={plate.name} number={plate.number} level={session.level} size={220} />
            <p className="text-sm font-bold text-highlight">Stolen Base Leader plaque earned for Baserunning IQ Level {session.level}.</p>
          </div>
        )}
        <p className="mt-3 text-4xl font-bold text-highlight tabular-nums">
          {result.correct}/{result.total} <span className="text-2xl text-muted">· {pct}%</span>
        </p>
        <p className="mt-2 text-sm">
          {badge
            ? result.passed
              ? `Level ${session.level} passed${session.level < 3 ? `. Level ${session.level + 1} is unlocked` : ". Every level passed"}.`
              : `${PASS_PCT}% passes Level ${session.level} (${needed(result.total)} of ${result.total}).`
            : result.passed
            ? result.awardEarned
              ? position
                ? `${position} Golden Glove earned.`
                : extra
                  ? "Every library question answered at 80% or better. The GGG Champions Trophy is yours."
                  : `Level ${session.level} passed. Championship ring earned${session.level < 3 ? `, and Level ${session.level + 1} is unlocked` : ""}.`
              : `Passed again. The ${award} is already in the case.`
            : `${PASS_PCT}% earns the ${award} (${needed(result.total)} of ${result.total}).`}
        </p>
        {perfect && (
          <div className="mt-4 flex flex-col items-center gap-1">
            <MvpBadge label={mvpLabel(session)} size={84} />
            <p className="text-xs text-muted">Perfect score: MVP badge earned.</p>
          </div>
        )}
        {!perfect && <p className="mt-2 text-xs text-muted">Review every miss to earn the MVP badge for this test.</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {missed > 0 && (
            <button type="button" onClick={() => review(session, session.attemptId)} className={buttonClass} disabled={pending}>
              Review the {missed} I missed
            </button>
          )}
          <button type="button" onClick={exit} className={missed > 0 ? secondaryButtonClass : buttonClass}>
            Back to tests
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ---- review complete --------------------------------------------------------
  if (session?.mode === "review" && reviewDone) {
    const total = session.questions.length;
    const right = session.questions.filter((q) => session.done[q.id]?.correct).length;
    return (
      <div className="rounded-xl border border-neon bg-neon/10 p-6 text-center">
        <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">{testName(session)} · Review</p>
        <div className="mt-4 flex justify-center">
          <MvpBadge label={mvpLabel(session)} size={96} />
        </div>
        <p className="mt-3 text-3xl font-bold text-highlight">Review complete · MVP</p>
        <p className="mt-2 text-sm">
          {right} of {total} right on the second try. {right === total ? "Every miss turned into a make." : "Read the explanations once more, then take the test again."}
        </p>
        <button type="button" onClick={exit} className={`${buttonClass} mt-5`}>
          Back to tests
        </button>
      </div>
    );
  }

  // ---- a question (test or review) ------------------------------------------------
  if (session && session.index < session.questions.length) {
    const q = session.questions[session.index];
    const spec = q.diagram as DiamondSpec | null;
    const answeredCount = Object.keys(session.done).length;
    const rightCount = Object.values(session.done).filter((a) => a.correct).length;
    const reviewing = session.mode === "review";
    const library = session.track === "extra" && !reviewing;
    const hintsAllowed = reviewing || session.track === "extra";
    return (
      <div className={`rounded-xl border p-4 sm:p-6 ${reviewing ? "border-pink/50 bg-pink/5" : "border-navy-600 bg-navy-950/50"}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs tracking-widest text-pink-soft uppercase">
            {testName(session)}
            {reviewing && " · Reviewing misses"}
            {library && q.section && ` · ${q.section}`}
          </span>
          <button type="button" onClick={exit} className={secondaryButtonClass}>
            {reviewing ? "Exit review" : "Save & exit"}
          </button>
        </div>
        <ProgressBar
          value={answeredCount}
          max={session.questions.length}
          label={
            reviewing
              ? `${answeredCount} of ${session.questions.length} reviewed`
              : `${answeredCount} of ${session.questions.length} answered · ${rightCount} right · progress saved`
          }
        />
        {library && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Library shelves">
            <button
              type="button"
              onClick={() => pickShelf(null)}
              disabled={Boolean(feedback)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-wider uppercase ${session.shelf === null ? "border-pink bg-pink/15 text-ink" : "border-navy-600 text-muted hover:border-pink"}`}
            >
              Any shelf
            </button>
            {shelvesOf(session.questions, session.done).map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => pickShelf(s.name)}
                disabled={Boolean(feedback) || s.answered === s.count}
                className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-wider uppercase disabled:opacity-50 ${session.shelf === s.name ? "border-pink bg-pink/15 text-ink" : "border-navy-600 text-muted hover:border-pink"}`}
              >
                {s.name} <span className="tabular-nums">{s.answered}/{s.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className={`mt-5 grid gap-5 ${spec ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : ""}`}>
          {spec && <Diamond spec={spec} className="mx-auto w-full max-w-sm md:max-w-none" />}
          <div>
            <p className="text-sm text-ink/80 italic">{q.scenario}</p>
            <p className="mt-2 text-lg font-semibold">{q.question}</p>

            {hintsAllowed && !feedback && (
              <div className="mt-3">
                {hint === null ? (
                  <button type="button" onClick={showHint} disabled={pending} className="text-sm text-pink-soft underline">
                    Show a hint
                  </button>
                ) : (
                  <p className="rounded-lg border border-pink/50 bg-pink/10 px-3 py-2 text-sm">
                    <span className="mr-1 font-mono text-[11px] font-bold tracking-wider text-pink-soft uppercase">Hint</span>
                    {hint}
                  </p>
                )}
              </div>
            )}

            <ol className="mt-4 grid gap-2">
              {q.choices.map((choice, i) => {
                const isCorrect = feedback && i === feedback.correctIndex;
                const isWrongPick = feedback && i === feedback.chosen && !feedback.correct;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={Boolean(feedback) || pending || !canEdit}
                      onClick={() => answer(i)}
                      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${
                        isCorrect
                          ? "border-neon bg-neon/15"
                          : isWrongPick
                            ? "border-pink bg-pink/15"
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
            {feedback && (
              <div className="mt-4" aria-live="polite">
                <p className={`font-bold ${feedback.correct ? "text-highlight" : "text-pink-soft"}`}>{feedback.correct ? "Correct." : "Not quite."}</p>
                {feedback.explanation && <p className="mt-1 text-sm text-ink/90">{feedback.explanation}</p>}
                <button type="button" onClick={next} disabled={pending} className={`${buttonClass} mt-4`}>
                  {nextOpen(session.questions, session.done, session.index + 1) < session.questions.length
                    ? "Next question"
                    : reviewing
                      ? "Finish review"
                      : pending
                        ? "Grading…"
                        : "Finish test"}
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- every question answered (e.g. resumed after the last answer) ----------------
  if (session?.mode === "test") {
    return (
      <div className="rounded-xl border border-navy-600 p-6 text-center">
        <p className="text-sm">Every question in this test is answered.</p>
        <button type="button" onClick={next} disabled={pending} className={`${buttonClass} mt-4`}>
          {pending ? "Grading…" : "Finish test"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ---- pick a test ------------------------------------------------------------------
  return (
    <>
      <section>
        <DetailHeading>Playbook tests · score 80% to earn the ring and unlock the next level</DetailHeading>
        <TrackPicker tracks={tracks} actions={actions} />
      </section>
      {badgeTracks.length > 0 && (
        <section>
          <DetailHeading>{badgeTracks.map((t) => t.label).join(" · ")} · score 80% to unlock the next level · MVP badges</DetailHeading>
          <BadgeTrackPicker tracks={badgeTracks} actions={actions} />
        </section>
      )}
      <section>
        <DetailHeading>Position IQ · Golden Glove</DetailHeading>
        <PositionPicker positions={positions} plate={plate} actions={actions} />
      </section>
      {course && (
        <section>
          <DetailHeading>How to Keep the Book · Manager of the Year</DetailHeading>
          {course}
        </section>
      )}
      <section>
        <DetailHeading>Extra Credit Library · GGG Champions Trophy</DetailHeading>
        <LibraryPicker library={library} actions={actions} />
      </section>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!canEdit && <p className="text-xs text-muted">Viewers can see progress; a coach runs the test with the player.</p>}
    </>
  );
}
