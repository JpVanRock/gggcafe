"use server";

import { actForCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";

export type QuizResult = { error: string | null; is_correct?: boolean; correct_index?: number; explanation?: string | null };

/** Grade one team-quiz answer on the server (the database checks it's her team's published quiz). */
export async function answerTeamQuiz(playerId: string, questionId: string, chosen: number): Promise<QuizResult> {
  const denied = await actForCheck(playerId);
  if (denied) return { error: denied };
  if (!isUuid(questionId) || !Number.isInteger(chosen) || chosen < 0 || chosen > 4) return { error: "Pick an answer." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("answer_team_quiz", { p_player_id: playerId, p_question_id: questionId, p_chosen: chosen });
  if (error) return { error: error.code === "42501" ? "This quiz isn't open to you." : "Couldn't save your answer. Try again." };
  const row = ((data ?? []) as { is_correct: boolean; correct_index: number; explanation: string | null }[])[0];
  if (!row) return { error: "Couldn't save your answer. Try again." };
  return { error: null, ...row };
}
