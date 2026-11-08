import { Disclosure, secondaryButtonClass } from "@/components/ui";
import { FIELD_POSITIONS, POSITION_LABEL, type Position } from "@/lib/softball";
import { setIqQuestionActive } from "./actions";
import type { IqData, IqQuestion } from "./data";
import { RingCase, TRACK_LABEL, type RingTrack } from "@/components/rings";
import { GoldenGlove } from "@/components/golden-glove";
import { formatLongDate } from "@/lib/dates";
import {
  IqQuestionForm, IqTests, QuizRunner, type BadgeTrackInfo, type LevelInfo, type LibraryInfo, type Nameplate,
  type PositionInfo, type QuizInfo, type TrackInfo,
} from "./iq-client";
import { DetailHeading, MenuItem } from "./menu";
import { CourseCard, buildCourse } from "./scorebook";
import { BADGE_TRACK_LABEL, type BadgeTrack } from "@/lib/iq-tracks";

const QUIZ_POSITIONS: readonly Position[] = FIELD_POSITIONS;

/** The quizzes this player gets: General, Hitting, Pitching, and one per position they play. */
export function buildQuizzes(iq: IqData, positions: Position[]): QuizInfo[] {
  // Practice quizzes use the free-standing questions; playbook level questions are tested in their levels.
  const active = iq.questions.filter((q) => q.active && !q.track);
  const latest = new Map<string, boolean>(); // question -> was the most recent answer right?
  for (const a of iq.answers) if (!a.attempt_id && !a.review_of) latest.set(a.question_id, a.is_correct);

  const sections: { key: string; label: string; match: (q: IqQuestion) => boolean }[] = [
    { key: "general", label: "General IQ", match: (q) => q.topic === "general" },
    { key: "hitting", label: "Hitting IQ", match: (q) => q.topic === "hitting" },
    { key: "pitching", label: "Pitching IQ", match: (q) => q.topic === "pitching" },
    ...[...new Set(positions)]
      .filter((p) => QUIZ_POSITIONS.includes(p))
      .map((p) => ({ key: `position:${p}`, label: `${POSITION_LABEL[p]} IQ`, match: (q: IqQuestion) => q.topic === "position" && q.position === p })),
  ];

  return sections.map(({ key, label, match }) => {
    const questions = active.filter(match);
    const ids = new Set(questions.map((q) => q.id));
    const answers = iq.answers.filter((a) => ids.has(a.question_id) && !a.attempt_id && !a.review_of);
    const rank = (q: IqQuestion) => (!latest.has(q.id) ? 0 : latest.get(q.id) ? 2 : 1); // new, missed, mastered
    return {
      key,
      label,
      questions: [...questions]
        .sort((a, b) => rank(a) - rank(b))
        .map(({ id, scenario, question, choices }) => ({ id, scenario, question, choices })),
      stats: {
        answered: answers.length,
        pct: answers.length ? Math.round((100 * answers.filter((a) => a.is_correct).length) / answers.length) : null,
        mastered: questions.filter((q) => latest.get(q.id) === true).length,
        total: questions.length,
      },
    };
  });
}

const TRACK_BLURB: Record<RingTrack, string> = {
  defense: "Where to go with the ball, coverage and backups, from the Softball IQ Defensive Playbook.",
  baserunning: "Reads, leads, tags and running decisions, from the Softball IQ Baserunning Playbook.",
};

/** Best score, the open test's progress, and the last finished test's misses, for one test. */
function testState(iq: IqData, attempts: IqData["attempts"], questionCount: number) {
  // attempts are newest first
  const finished = attempts.filter((a) => a.finished_at && a.total);
  const best = finished.reduce<{ correct: number; total: number } | null>(
    (b, a) => (!b || a.correct! / a.total! > b.correct / b.total ? { correct: a.correct!, total: a.total! } : b),
    null,
  );

  const open = attempts.find((a) => !a.finished_at);
  const inProgress = open
    ? { answered: iq.answers.filter((x) => x.attempt_id === open.id).length, total: open.question_order?.length ?? questionCount }
    : null;

  const last = finished[0];
  let lastFinished: LevelInfo["lastFinished"] = null;
  if (last) {
    const right = new Set(iq.answers.filter((x) => x.attempt_id === last.id && x.is_correct).map((x) => x.question_id));
    const missedIds = (last.question_order ?? []).filter((id) => !right.has(id));
    const reviewed = new Set(iq.answers.filter((x) => x.review_of === last.id && missedIds.includes(x.question_id)).map((x) => x.question_id));
    lastFinished = { attemptId: last.id, missed: missedIds.length, reviewed: reviewed.size, reviewedAt: last.reviewed_at };
  }
  return { questionCount, best, inProgress, lastFinished };
}

/** Level status for each playbook track: earned, open (next to take), or locked. */
export function buildTracks(iq: IqData): TrackInfo[] {
  return (["defense", "baserunning"] as RingTrack[]).map((track) => ({
    track,
    label: TRACK_LABEL[track],
    blurb: TRACK_BLURB[track],
    levels: [1, 2, 3].map((level) => {
      const ring = iq.rings.find((r) => r.track === track && r.level === level);
      const prevRing = level === 1 || iq.rings.some((r) => r.track === track && r.level === level - 1);
      const questionCount = iq.questions.filter((q) => q.active && q.track === track && q.level === level).length;
      return {
        level,
        status: ring ? "earned" : prevRing ? "open" : "locked",
        earnedOn: ring ? formatLongDate(ring.earned_on) : null,
        ...testState(iq, iq.attempts.filter((a) => a.track === track && a.level === level), questionCount),
      };
    }),
  }));
}

const BADGE_BLURB: Record<BadgeTrack, string> = {
  offense: "Counts, situational hitting, the short game and slapping: smart at-bats, written for fastpitch.",
  battery: "Pitch calling for pitchers and catchers: counts, location, sequencing and sign security.",
};

/** Offense IQ (and Battery IQ once it has questions): passing a level unlocks the next; each level's award is the MVP badge. */
export function buildBadgeTracks(iq: IqData): BadgeTrackInfo[] {
  return (["offense", "battery"] as BadgeTrack[])
    .filter((track) => iq.questions.some((q) => q.active && q.track === track))
    .map((track) => ({
      track,
      label: BADGE_TRACK_LABEL[track],
      blurb: BADGE_BLURB[track],
      levels: [1, 2, 3].map((level) => {
        const attempts = iq.attempts.filter((a) => a.track === track && a.level === level);
        const passed = attempts.filter((a) => a.passed && a.finished_at).sort((a, b) => (a.finished_at ?? "").localeCompare(b.finished_at ?? ""))[0];
        const prevPassed = level === 1 || iq.attempts.some((a) => a.track === track && a.level === level - 1 && a.passed);
        const questionCount = iq.questions.filter((q) => q.active && q.track === track && q.level === level).length;
        return {
          level,
          status: passed ? "earned" : prevPassed ? "open" : "locked",
          earnedOn: passed?.finished_at ? formatLongDate(passed.finished_at.slice(0, 10)) : null,
          mvp: iq.mvps.some((m) => m.track === track && m.level === level),
          ...testState(iq, attempts, questionCount),
        } satisfies BadgeTrackInfo["levels"][number];
      }),
    }));
}

/** Position tests (one level each) and Golden Gloves, for every position on the field. `mine` starts with her primary position. */
export function buildPositions(iq: IqData, mine: Position[]): PositionInfo[] {
  return FIELD_POSITIONS.map((position) => {
    const glove = iq.gloves.find((g) => g.position === position);
    const questionCount = iq.questions.filter((q) => q.active && q.track === "position" && q.position === position).length;
    return {
      position,
      label: POSITION_LABEL[position],
      mine: mine.includes(position),
      primary: mine[0] === position,
      earnedOn: glove ? formatLongDate(glove.earned_on) : null,
      earnedYear: glove ? glove.earned_on.slice(0, 4) : null,
      ...testState(iq, iq.attempts.filter((a) => a.track === "position" && a.position === position), questionCount),
    };
  });
}

/** The Extra Credit Library: shelves, her runs, and the Champions Trophy. */
export function buildLibrary(iq: IqData): LibraryInfo {
  const questions = iq.questions.filter((q) => q.active && q.track === "extra");
  const shelves = new Map<string, number>();
  for (const q of questions) shelves.set(q.section ?? "Library", (shelves.get(q.section ?? "Library") ?? 0) + 1);
  return {
    shelves: [...shelves].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
    trophyEarnedOn: iq.championsTrophy ? formatLongDate(iq.championsTrophy.earned_on) : null,
    ...testState(iq, iq.attempts.filter((a) => a.track === "extra"), questions.length),
  };
}

/** Earned Golden Gloves, each engraved with her name and number. */
export function GloveCase({ positions, plate, size = 220 }: { positions: PositionInfo[]; plate: Nameplate; size?: number }) {
  const earned = positions.filter((p) => p.earnedOn);
  if (!earned.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {earned.map((p) => (
        <figure key={p.position} className="flex flex-col items-center gap-2">
          <GoldenGlove name={plate.name} number={plate.number} position={p.label} year={p.earnedYear} size={size} />
          <figcaption className="font-mono text-[11px] tracking-wider text-muted uppercase">
            {p.label} · {p.earnedOn}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function IqSummary({
  quizzes,
  tracks,
  badgeTracks = [],
  positions,
  plate,
  rings,
  bookDone = 0,
}: {
  quizzes: QuizInfo[];
  tracks: TrackInfo[];
  badgeTracks?: BadgeTrackInfo[];
  positions: PositionInfo[];
  plate: Nameplate;
  rings: IqData["rings"];
  /** chapters of How to Keep the Book complete */
  bookDone?: number;
}) {
  const gloves = positions.filter((p) => p.earnedOn);
  return (
    <div>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {tracks.map((t) => {
          const earned = t.levels.filter((l) => l.status === "earned").length;
          const next = t.levels.find((l) => l.status === "open");
          return (
            <MenuItem
              key={t.track}
              name={t.label}
              value={`${earned}/3`}
              note={earned === 3 ? "All three rings earned" : next ? `Level ${next.level} is next` : "Locked"}
            />
          );
        })}
        {badgeTracks.map((t) => {
          const passed = t.levels.filter((l) => l.status === "earned").length;
          const mvps = t.levels.filter((l) => l.mvp).length;
          return (
            <MenuItem
              key={t.track}
              name={t.label}
              value={`${passed}/3`}
              note={mvps ? `${mvps} MVP badge${mvps === 1 ? "" : "s"}` : passed === 3 ? "Every level passed" : `Level ${passed + 1} is next`}
            />
          );
        })}
        <MenuItem
          name="Position IQ"
          value={gloves.length}
          note={gloves.length ? `Golden Glove: ${gloves.map((g) => g.position).join(", ")}` : "Earn a Golden Glove at any position"}
        />
        <MenuItem
          name="Keep the Book"
          value={`${bookDone}/6`}
          note={bookDone === 6 ? "Every chapter complete" : "Manager of the Year for each chapter"}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-center gap-6">
        <RingCase earned={rings} size={40} showLabels={false} />
        {gloves.map((g) => (
          <GoldenGlove key={g.position} name={plate.name} number={plate.number} position={g.label} engrave={false} size={64} />
        ))}
      </div>
      <PracticeLine quizzes={quizzes} />
    </div>
  );
}

function PracticeLine({ quizzes }: { quizzes: QuizInfo[] }) {
  const answered = quizzes.reduce((n, q) => n + q.stats.answered, 0);
  return (
    <p className="mt-4 font-mono text-xs tracking-wider text-muted uppercase">
      Practice: {quizzes.map((q) => q.label.replace(" IQ", "")).join(" · ")}
      {answered ? ` · ${answered} answered` : ""}
    </p>
  );
}

function topicLabel(q: IqQuestion) {
  if (q.track === "position" && q.position) return `${POSITION_LABEL[q.position]} · Golden Glove test`;
  if (q.track === "extra") return `Extra Credit · ${q.section ?? "Library"}`;
  if (q.track === "scorebook") return `How to Keep the Book · Chapter ${q.level} quiz`;
  if (q.track === "defense" || q.track === "baserunning") return `${TRACK_LABEL[q.track]} · Level ${q.level}`;
  if (q.topic === "position" && q.position) return `${POSITION_LABEL[q.position]} IQ`;
  return { general: "General IQ", hitting: "Hitting IQ", pitching: "Pitching IQ", position: "Position IQ" }[q.topic];
}

export function IqDetail({
  playerId,
  quizzes,
  tracks,
  badgeTracks = [],
  positions,
  library,
  plate,
  iq,
  canEdit,
  canManage = canEdit,
}: {
  playerId: string;
  quizzes: QuizInfo[];
  tracks: TrackInfo[];
  badgeTracks?: BadgeTrackInfo[];
  positions: PositionInfo[];
  library: LibraryInfo;
  plate: Nameplate;
  iq: IqData;
  canEdit: boolean;
  /** coaches/admins: the shared question bank (shows answers) */
  canManage?: boolean;
}) {
  const byId = new Map(iq.questions.map((q) => [q.id, q]));
  // Practice misses only: level-test misses have their own review (with hints) in Playbook tests.
  const practice = iq.answers.filter((a) => !a.attempt_id && !a.review_of);
  const missed = [...new Map(practice.map((a) => [a.question_id, a])).values()]
    .filter((a) => !a.is_correct)
    .map((a) => byId.get(a.question_id))
    .filter((q): q is IqQuestion => Boolean(q?.active && !q.track));

  return (
    <div className="flex flex-col gap-8">
      <section>
        <DetailHeading>Championship rings</DetailHeading>
        <RingCase earned={iq.rings} size={72} />
      </section>

      {positions.some((p) => p.earnedOn) && (
        <section>
          <DetailHeading>Golden Gloves</DetailHeading>
          <GloveCase positions={positions} plate={plate} />
        </section>
      )}

      <IqTests
        playerId={playerId}
        tracks={tracks}
        badgeTracks={badgeTracks}
        positions={positions}
        library={library}
        plate={plate}
        canEdit={canEdit}
        course={<CourseCard playerId={playerId} course={buildCourse(iq)} plate={plate} />}
      />

      <section>
        <DetailHeading>Practice quizzes</DetailHeading>
        <QuizRunner playerId={playerId} quizzes={quizzes} canEdit={canEdit} />
      </section>

      {missed.length > 0 && (
        // Collapsed so the answers don't show while a quiz is running.
        <Disclosure summary={`Review missed practice questions (${missed.length}) · shows the answers`}>
          <ul className="grid gap-3 md:grid-cols-2">
            {missed.map((q) => (
              <li key={q.id} className="rounded-xl border border-pink/50 p-3 text-sm">
                <p className="font-mono text-[11px] tracking-wider text-pink-soft uppercase">{topicLabel(q)}</p>
                <p className="mt-1 text-ink/80 italic">{q.scenario}</p>
                <p className="mt-1 font-semibold">{q.question}</p>
                <p className="mt-2 text-highlight">✓ {q.choices[q.correct_index]}</p>
                {q.explanation && <p className="mt-1 text-xs text-muted">{q.explanation}</p>}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      {canManage && (
        <Disclosure summary={`Question bank · ${iq.questions.filter((q) => q.active).length} active (shared by every player)`}>
          <div className="flex flex-col gap-6">
            <Disclosure summary="Add a question">
              <IqQuestionForm />
            </Disclosure>
            <ul className="divide-y divide-navy-700">
              {iq.questions.map((q) => (
                <li key={q.id} className={`py-3 ${q.active ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] tracking-wider text-pink-soft uppercase">
                        {topicLabel(q)}
                        {!q.active && " · hidden"}
                      </p>
                      <p className="mt-1 text-sm">{q.scenario}</p>
                      <p className="text-sm font-semibold">{q.question}</p>
                      <p className="mt-1 text-xs text-highlight">✓ {q.choices[q.correct_index]}</p>
                    </div>
                    <form action={setIqQuestionActive}>
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="active" value={q.active ? "false" : "true"} />
                      <button type="submit" className={secondaryButtonClass}>
                        {q.active ? "Hide" : "Show"}
                      </button>
                    </form>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted hover:text-ink">Edit</summary>
                    <div className="mt-3 rounded-lg border border-navy-700 p-3">
                      <IqQuestionForm question={q} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </Disclosure>
      )}
    </div>
  );
}
