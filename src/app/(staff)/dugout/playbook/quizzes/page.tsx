import type { Metadata } from "next";
import Link from "next/link";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { PlaybookNav } from "../nav";
import { NewQuizForm } from "../forms";

export const metadata: Metadata = { title: "Team Quizzes · Coaches Dugout · GGG.Cafe" };

type QuizRow = {
  id: string;
  title: string;
  published_at: string | null;
  created_at: string;
  questions: { id: string; answers: { player_id: string }[] }[];
};

export default async function QuizzesPage({ searchParams }: PageProps<"/dugout/playbook/quizzes">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;

  const { data } = await supabase
    .from("team_quizzes")
    .select("id, title, published_at, created_at, questions:team_quiz_questions(id, answers:team_quiz_answers(player_id))")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false });
  const quizzes = (data ?? []) as QuizRow[];

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/playbook/quizzes" />
      <PlaybookNav current="quizzes" teamId={team.id} />
      <p className="text-sm text-muted">
        Short quizzes on your own calls and systems. Published quizzes show on each {team.name} player&apos;s Softball IQ page (Team
        Playbook); she gets the answer and your explanation right after each question, and her first try is her score.
      </p>
      {editor && (
        <Card title="New quiz">
          <NewQuizForm teamId={team.id} />
        </Card>
      )}
      {quizzes.length === 0 ? (
        <EmptyState>No team quizzes yet.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {quizzes.map((q) => {
            const players = new Set(q.questions.flatMap((x) => x.answers.map((a) => a.player_id)));
            return (
              <li key={q.id}>
                <Link
                  href={`/dugout/playbook/quizzes/${q.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-700 bg-navy-900/70 p-4 transition hover:border-pink hover:bg-navy-800"
                >
                  <span>
                    <span className="block font-semibold text-ink">{q.title}</span>
                    <span className="text-sm text-muted">
                      {q.questions.length} question{q.questions.length === 1 ? "" : "s"} · {players.size} player{players.size === 1 ? "" : "s"} started ·{" "}
                      {formatDay(q.created_at.slice(0, 10))}
                    </span>
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${
                      q.published_at ? "bg-neon text-on-accent" : "border border-pink text-pink-soft"
                    }`}
                  >
                    {q.published_at ? "Published" : "Draft"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
