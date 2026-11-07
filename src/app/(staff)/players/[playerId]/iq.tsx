import { Disclosure, secondaryButtonClass } from "@/components/ui";
import { POSITION_LABEL, type Position } from "@/lib/softball";
import { setIqQuestionActive } from "./actions";
import type { IqData, IqQuestion } from "./data";
import { IqQuestionForm, QuizRunner, type QuizInfo } from "./iq-client";
import { DetailHeading, MenuItem } from "./menu";

const QUIZ_POSITIONS: Position[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

/** The quizzes this player gets: General, Hitting, Pitching, and one per position they play. */
export function buildQuizzes(iq: IqData, positions: Position[]): QuizInfo[] {
  const active = iq.questions.filter((q) => q.active);
  const latest = new Map<string, boolean>(); // question -> was the most recent answer right?
  for (const a of iq.answers) latest.set(a.question_id, a.is_correct);

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
    const answers = iq.answers.filter((a) => ids.has(a.question_id));
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

export function IqSummary({ quizzes }: { quizzes: QuizInfo[] }) {
  const answered = quizzes.reduce((n, q) => n + q.stats.answered, 0);
  return (
    <div>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {quizzes.map((q) => (
          <MenuItem
            key={q.key}
            name={q.label}
            value={q.stats.pct === null ? "New" : `${q.stats.pct}%`}
            note={`${q.stats.mastered}/${q.stats.total} scenarios mastered`}
          />
        ))}
      </div>
      <p className="mt-5 font-mono text-xs tracking-wider text-muted uppercase">
        {answered ? `${answered} answers so far` : "Game scenarios, multiple choice"}
      </p>
    </div>
  );
}

function topicLabel(q: IqQuestion) {
  if (q.topic === "position" && q.position) return `${POSITION_LABEL[q.position]} IQ`;
  return { general: "General IQ", hitting: "Hitting IQ", pitching: "Pitching IQ", position: "Position IQ" }[q.topic];
}

export function IqDetail({
  playerId,
  quizzes,
  iq,
  canEdit,
}: {
  playerId: string;
  quizzes: QuizInfo[];
  iq: IqData;
  canEdit: boolean;
}) {
  const byId = new Map(iq.questions.map((q) => [q.id, q]));
  const missed = [...new Map(iq.answers.map((a) => [a.question_id, a])).values()]
    .filter((a) => !a.is_correct)
    .map((a) => byId.get(a.question_id))
    .filter((q): q is IqQuestion => Boolean(q?.active));

  return (
    <div className="flex flex-col gap-8">
      <section>
        <DetailHeading>Take a quiz</DetailHeading>
        <QuizRunner playerId={playerId} quizzes={quizzes} canEdit={canEdit} />
      </section>

      {missed.length > 0 && (
        // Collapsed so the answers don't show while a quiz is running.
        <Disclosure summary={`Review missed questions (${missed.length}) · shows the answers`}>
          <ul className="grid gap-3 md:grid-cols-2">
            {missed.map((q) => (
              <li key={q.id} className="rounded-xl border border-pink/50 p-3 text-sm">
                <p className="font-mono text-[11px] tracking-wider text-pink-soft uppercase">{topicLabel(q)}</p>
                <p className="mt-1 text-ink/80 italic">{q.scenario}</p>
                <p className="mt-1 font-semibold">{q.question}</p>
                <p className="mt-2 text-neon">✓ {q.choices[q.correct_index]}</p>
                {q.explanation && <p className="mt-1 text-xs text-muted">{q.explanation}</p>}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      {canEdit && (
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
                      <p className="mt-1 text-xs text-neon">✓ {q.choices[q.correct_index]}</p>
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
