import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, Loading, buttonClass, secondaryButtonClass, tableClass, tdClass, thClass } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { isUuid } from "@/lib/softball";
import { quizScore } from "@/lib/playbook";
import { loadTeamRoster } from "../../../training/data";
import { deleteQuiz, publishQuiz, removeQuizQuestion } from "../../actions";
import { QuizQuestionForm } from "../../forms";

export const metadata: Metadata = { title: "Team Quiz · Coaches Dugout · GGG.Cafe" };

export default function QuizPage({ params }: PageProps<"/dugout/playbook/quizzes/[quizId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Quiz params={params} />
    </Suspense>
  );
}

type QuestionRow = {
  id: string;
  position: number;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  play: { name: string } | null;
};
type AnswerRow = { player_id: string; question_id: string; is_correct: boolean; first_correct: boolean };

async function Quiz({ params }: Pick<PageProps<"/dugout/playbook/quizzes/[quizId]">, "params">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { quizId } = await params;
  if (!isUuid(quizId)) notFound();
  const supabase = await createClient();
  const { data: quizData } = await supabase.from("team_quizzes").select("id, title, published_at, team_id, team:teams(name)").eq("id", quizId).maybeSingle();
  if (!quizData) notFound();
  const quiz = quizData as unknown as { id: string; title: string; published_at: string | null; team_id: string; team: { name: string } | null };

  const [questionsResult, playsResult, roster] = await Promise.all([
    supabase.from("team_quiz_questions").select("id, position, question, choices, correct_index, explanation, play:playbook_plays(name)").eq("quiz_id", quizId).order("position"),
    supabase.from("playbook_plays").select("id, name").or(`team_id.eq.${quiz.team_id},team_id.is.null`).eq("active", true).order("name"),
    loadTeamRoster(supabase, quiz.team_id),
  ]);
  const questions = (questionsResult.data ?? []) as unknown as QuestionRow[];
  const { data: answerData } = questions.length
    ? await supabase.from("team_quiz_answers").select("player_id, question_id, is_correct, first_correct").in("question_id", questions.map((q) => q.id))
    : { data: [] };
  const answers = (answerData ?? []) as AnswerRow[];
  const plays = (playsResult.data ?? []) as { id: string; name: string }[];

  const results = roster
    .map((p) => {
      const mine = new Map(answers.filter((a) => a.player_id === p.id).map((a) => [a.question_id, a]));
      return { ...p, score: quizScore(questions.map((q) => mine.get(q.id) ?? { first_correct: null, is_correct: null })) };
    })
    .sort((a, b) => b.score.answered - a.score.answered || b.score.firstTry - a.score.firstTry || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dugout/playbook/quizzes?team=${quiz.team_id}`} className="text-sm text-muted hover:text-ink">
        ← Team quizzes · {quiz.team?.name}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Team quiz · {quiz.published_at ? "Published" : "Draft"}</p>
          <h2 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">{quiz.title}</h2>
        </div>
        {editor && (
          <div className="flex flex-wrap items-center gap-3">
            <form action={publishQuiz}>
              <input type="hidden" name="id" value={quiz.id} />
              <input type="hidden" name="publish" value={quiz.published_at ? "0" : "1"} />
              <button type="submit" disabled={!quiz.published_at && questions.length === 0} className={quiz.published_at ? secondaryButtonClass : buttonClass}>
                {quiz.published_at ? "Take it back to draft" : "Publish to players"}
              </button>
            </form>
            <form action={deleteQuiz}>
              <input type="hidden" name="id" value={quiz.id} />
              <input type="hidden" name="team_id" value={quiz.team_id} />
              <ConfirmSubmit message={`Delete “${quiz.title}” and every player's answers?`} className="text-sm text-muted hover:text-danger">
                Delete quiz
              </ConfirmSubmit>
            </form>
          </div>
        )}
      </header>

      <Card title={`Questions (${questions.length})`}>
        {questions.length === 0 ? (
          <EmptyState>No questions yet.</EmptyState>
        ) : (
          <ol className="flex flex-col divide-y divide-navy-700">
            {questions.map((q, i) => (
              <li key={q.id} className="flex gap-3 py-3">
                <span className="w-6 font-display text-lg font-bold text-highlight tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-ink">{q.question}</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {q.choices.map((c, ci) => (
                      <li key={ci} className={ci === q.correct_index ? "font-semibold text-highlight" : "text-muted"}>
                        {ci === q.correct_index ? "✓ " : "· "}
                        {c}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && <p className="mt-1.5 text-xs text-muted">Why: {q.explanation}</p>}
                  {q.play && <p className="mt-1 text-xs text-pink-soft">Play: {q.play.name}</p>}
                </div>
                {editor && (
                  <form action={removeQuizQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <ConfirmSubmit message="Remove this question (and the answers to it)?" className="text-xs text-muted hover:text-danger">
                      Remove
                    </ConfirmSubmit>
                  </form>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {editor && (
        <Card title="Add a question">
          <QuizQuestionForm quizId={quiz.id} plays={plays} />
        </Card>
      )}

      <Card title="Results">
        {questions.length === 0 || roster.length === 0 ? (
          <p className="text-sm text-muted">Results show here once players start.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Player</th>
                  <th className={thClass}>Answered</th>
                  <th className={thClass}>First try</th>
                  <th className={thClass}>Still to fix</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}>
                      {r.jersey ? `#${r.jersey} ` : ""}
                      {r.name}
                    </td>
                    <td className={`${tdClass} tabular-nums`}>
                      {r.score.answered}/{r.score.total}
                    </td>
                    <td className={`${tdClass} tabular-nums`}>{r.score.answered ? `${r.score.firstTry} (${r.score.pct}%)` : "–"}</td>
                    <td className={`${tdClass} tabular-nums`}>{r.score.answered ? r.score.toFix : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
