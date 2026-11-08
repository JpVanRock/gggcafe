// How to Keep the Book on the Softball IQ page: the course card (progress bar and
// chapter list, each chapter linking to its own page) and the data behind it.
import Link from "next/link";
import { CHAPTERS, QUIZ_LENGTH, chapterStatus, courseProgress, type ChapterStatus } from "@/lib/scorebook";
import { formatLongDate } from "@/lib/dates";
import { ProgressBar } from "@/components/progress-bar";
import { ManagerAward } from "@/components/manager-award";
import { OutlineText } from "@/components/athletic";
import { buttonClass } from "@/components/ui";
import { GAME_PLAYS } from "@/lib/scorebook-game";
import type { IqData } from "./data";
import type { Nameplate } from "./iq-client";

export type CourseChapter = {
  n: number;
  title: string;
  short: string;
  blurb: string;
  steps: number;
  status: ChapterStatus;
  /** furthest lesson step reached (0-based) */
  step: number;
  best: { correct: number; total: number } | null;
  /** an unfinished quiz she can resume */
  quizOpen: boolean;
  earnedOn: string | null;
  earnedYear: string | null;
};
export type Course = {
  chapters: CourseChapter[];
  done: number;
  total: number;
  next: number | null;
  /** the extra-credit game: opens after every chapter; won = she found the hidden award */
  game: { unlocked: boolean; won: boolean; batter: number | null };
};

export function buildCourse(iq: IqData): Course {
  const awards = iq.managerAwards.map((a) => a.chapter);
  const chapters = CHAPTERS.map((c) => {
    const award = iq.managerAwards.find((a) => a.chapter === c.n);
    const attempts = iq.attempts.filter((a) => a.track === "scorebook" && a.level === c.n);
    const best = attempts
      .filter((a) => a.finished_at && a.total)
      .reduce<{ correct: number; total: number } | null>(
        (b, a) => (!b || a.correct! / a.total! > b.correct / b.total ? { correct: a.correct!, total: a.total! } : b),
        null,
      );
    return {
      n: c.n,
      title: c.title,
      short: c.short,
      blurb: c.blurb,
      steps: c.steps.length,
      status: chapterStatus(c.n, iq.scorebookProgress, awards),
      step: iq.scorebookProgress.find((p) => p.chapter === c.n)?.step ?? 0,
      best,
      quizOpen: attempts.some((a) => !a.finished_at),
      earnedOn: award ? formatLongDate(award.earned_on) : null,
      earnedYear: award ? award.earned_on.slice(0, 4) : null,
    };
  });
  const progress = courseProgress(iq.scorebookProgress, awards);
  const open = iq.lastGame && !iq.lastGame.finished_at ? iq.lastGame : null;
  return {
    chapters,
    ...progress,
    game: {
      unlocked: progress.done === progress.total,
      won: iq.hiddenAwards.some((a) => a.award === "world-series"),
      batter: open ? Math.min(open.next_play, GAME_PLAYS) : null,
    },
  };
}

function statusLine(c: CourseChapter) {
  switch (c.status) {
    case "complete":
      return `Manager of the Year · ${c.earnedOn}`;
    case "quiz":
      return c.quizOpen ? "Quiz in progress" : c.best ? `Quiz: best ${c.best.correct}/${c.best.total}. Needs 80%.` : "Lessons done · quiz ready";
    case "reading":
      return `Step ${c.step + 1} of ${c.steps}`;
    case "new":
      return `${c.steps} steps · ${QUIZ_LENGTH}-question quiz`;
    case "locked":
      return `Opens after Chapter ${c.n - 1}`;
  }
}

export function chapterHref(playerId: string, n: number) {
  return `/players/${playerId}/iq/scorebook/${n}`;
}

function gameLine(game: Course["game"]) {
  if (!game.unlocked) return "Finish all six chapters to unlock";
  if (game.won) return "Clean book kept · check your Trophy Room";
  if (game.batter) return `In progress · batter ${game.batter} of ${GAME_PLAYS}`;
  return `2 innings · ${GAME_PLAYS} batters · mystery reward`;
}

/** The course on the Softball IQ page. */
export function CourseCard({ playerId, course, plate }: { playerId: string; course: Course; plate: Nameplate }) {
  const next = course.chapters.find((c) => c.n === course.next);
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-950/40 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <ManagerAward name={plate.name} earned={course.done > 0} engrave={false} size={92} />
        <div className="min-w-56 flex-1">
          <p className="text-sm text-muted">
            Learn to keep the scorebook in six short chapters. Finish a chapter&apos;s lessons, then score 80% or better on its{" "}
            {QUIZ_LENGTH}-question quiz to earn Manager of the Year. Chapters open in order.
          </p>
          <div className="mt-3">
            <ProgressBar value={course.done} max={course.total} label={`${course.done} of ${course.total} chapters complete`} />
          </div>
        </div>
        {next && (
          <Link href={chapterHref(playerId, next.n)} className={buttonClass}>
            {next.status === "quiz" ? "Take the quiz" : course.done || next.status === "reading" ? "Continue" : "Start the course"}
          </Link>
        )}
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {course.chapters.map((c) => {
          const locked = c.status === "locked";
          const inner = (
            <>
              <OutlineText className="w-9 shrink-0 text-center text-3xl" stroke={c.status === "complete" ? "var(--color-neon)" : undefined}>
                {String(c.n).padStart(2, "0")}
              </OutlineText>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{c.title}</span>
                <span className={`block font-mono text-[11px] tracking-wider uppercase ${c.status === "complete" ? "text-highlight" : "text-muted"}`}>
                  {statusLine(c)}
                </span>
              </span>
              {!locked && <span className="text-sm text-pink">→</span>}
            </>
          );
          return (
            <li key={c.n}>
              {locked ? (
                <div className="flex items-center gap-3 rounded-lg border border-navy-700 px-3 py-2.5 opacity-50">{inner}</div>
              ) : (
                <Link
                  href={chapterHref(playerId, c.n)}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition hover:border-pink hover:bg-navy-800 ${
                    c.status === "complete" ? "border-neon/50" : "border-navy-600"
                  }`}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
        <li className="md:col-span-2">
          {(() => {
            const inner = (
              <>
                <OutlineText className="w-9 shrink-0 text-center text-3xl" stroke="var(--color-pink)">
                  XC
                </OutlineText>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">Extra credit: keep the book for a real game</span>
                  <span className={`block font-mono text-[11px] tracking-wider uppercase ${course.game.won ? "text-highlight" : "text-pink-soft"}`}>
                    {gameLine(course.game)}
                  </span>
                </span>
                {course.game.unlocked && <span className="text-sm text-pink">→</span>}
              </>
            );
            return course.game.unlocked ? (
              <Link
                href={`/players/${playerId}/iq/scorebook/game`}
                className="flex items-center gap-3 rounded-lg border border-pink/50 px-3 py-2.5 transition hover:border-pink hover:bg-navy-800"
              >
                {inner}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-navy-600 px-3 py-2.5 opacity-60">{inner}</div>
            );
          })()}
        </li>
      </ol>
    </div>
  );
}
