import "server-only";
// Her team's call sheet (plays a coach put on it) and published team quizzes.
import type { createClient } from "@/lib/supabase/server";
import { PLAY_CATEGORY_LABEL, type PlayCategory } from "@/lib/playbook";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CallCard = { id: string; name: string; kind: string; situation: string | null; description: string };
export type TeamQuizSummary = {
  id: string;
  title: string;
  team_name: string;
  total: number;
  answered: number;
  first_try: number;
  to_fix: number;
};

/** Her active teams (any season), for the call sheet. */
async function activeTeamIds(supabase: Supabase, playerId: string): Promise<string[]> {
  const { data } = await supabase.from("roster_entries").select("team_id").eq("player_id", playerId).eq("active", true);
  return [...new Set(((data ?? []) as { team_id: string }[]).map((r) => r.team_id))];
}

export async function loadTeamPlaybook(supabase: Supabase, playerId: string): Promise<{ cards: CallCard[]; quizzes: TeamQuizSummary[] }> {
  const teamIds = await activeTeamIds(supabase, playerId);
  if (teamIds.length === 0) return { cards: [], quizzes: [] };
  const [plays, quizzes] = await Promise.all([
    supabase
      .from("playbook_plays")
      .select("id, name, category, situation, description")
      .eq("call_sheet", true)
      .eq("active", true)
      .or(`team_id.in.(${teamIds.join(",")}),team_id.is.null`)
      .order("name"),
    supabase.rpc("team_quizzes_for", { p_player_id: playerId }),
  ]);
  return {
    cards: ((plays.data ?? []) as { id: string; name: string; category: PlayCategory; situation: string | null; description: string }[]).map((p) => ({
      id: p.id,
      name: p.name,
      kind: PLAY_CATEGORY_LABEL[p.category],
      situation: p.situation,
      description: p.description,
    })),
    quizzes: ((quizzes.data ?? []) as TeamQuizSummary[]).filter((q) => q.total > 0),
  };
}

export type QuizQuestion = {
  id: string;
  question: string;
  choices: string[];
  chosen_index: number | null;
  is_correct: boolean | null;
  first_correct: boolean | null;
  correct_index: number | null;
  explanation: string | null;
};

/** One quiz for her: questions without answer keys until she has answered them; null when it isn't hers. */
export async function loadTeamQuiz(supabase: Supabase, playerId: string, quizId: string) {
  const [{ data: quiz }, { data: questions, error }] = await Promise.all([
    supabase.from("team_quizzes").select("id, title, team:teams(name)").eq("id", quizId).maybeSingle(),
    supabase.rpc("team_quiz_for", { p_player_id: playerId, p_quiz_id: quizId }),
  ]);
  if (!quiz || error) return null;
  const q = quiz as unknown as { id: string; title: string; team: { name: string } | null };
  return { id: q.id, title: q.title, team: q.team?.name ?? "", questions: (questions ?? []) as QuizQuestion[] };
}
