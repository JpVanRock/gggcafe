import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { isUuid } from "@/lib/softball";
import { loadPlayer } from "../../../../section-data";
import { loadTeamQuiz } from "../../../../playbook-data";
import { TeamQuizRunner } from "../../../../playbook-client";
import { SectionShell } from "../../../section-shell";

export const metadata: Metadata = { title: "Team Quiz · Softball IQ · GGG.Cafe" };

export default async function TeamQuizPage({ params }: PageProps<"/players/[playerId]/iq/playbook/[quizId]">) {
  const { playerId, quizId } = await params;
  if (!isUuid(quizId)) notFound();
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId, "player.iq");
  const player = await loadPlayer(supabase, playerId);
  const quiz = await loadTeamQuiz(supabase, player.id, quizId);
  if (!quiz || quiz.questions.length === 0) notFound();
  return (
    <SectionShell title={quiz.title} subtitle={`Team quiz · ${quiz.team}`}>
      <div className="flex flex-col gap-6">
        <Link href={`/players/${player.id}/iq/playbook`} className="text-sm text-link hover:underline">
          ← Team Playbook
        </Link>
        <TeamQuizRunner playerId={player.id} quizId={quiz.id} questions={quiz.questions} canAct={access.canAct} />
      </div>
    </SectionShell>
  );
}
