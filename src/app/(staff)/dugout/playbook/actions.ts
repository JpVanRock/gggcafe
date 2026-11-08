"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nextPosition } from "@/lib/db";
import { checkbox, friendlyDbError, isoDate, oneOf, text, wholeNumber, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { PLAY_CATEGORIES, PLAY_CATEGORY_LABEL, SCOUT_PROMPTS, parseChoices } from "@/lib/playbook";

const SCOUT_CATEGORIES = ["team_overview", "hitter_tendencies", "pitcher_tendencies", "defense", "baserunning", "coaching_tendencies", "other"] as const;

// ---------------------------------------------------------------------------
// Plays
// ---------------------------------------------------------------------------

export async function savePlay(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const id = text(fd, "id");
  const teamId = text(fd, "team_id");
  const scope = oneOf(fd, "scope", ["team", "all"] as const) ?? "team";
  const name = text(fd, "name");
  const category = oneOf(fd, "category", PLAY_CATEGORIES);
  const situation = text(fd, "situation");
  const description = text(fd, "description");
  if (!isUuid(teamId)) return { error: "Choose a team." };
  if (!name || name.length > 60) return { error: "Name the call, up to 60 characters." };
  if (!category) return { error: "Pick what kind of play it is." };
  if (situation && situation.length > 200) return { error: "Keep “when to call it” to 200 characters." };
  if (!description || description.length > 1000) return { error: "Write what everyone does, up to 1,000 characters." };

  const row = {
    team_id: scope === "all" ? null : teamId,
    name,
    category,
    situation,
    description,
    call_sheet: checkbox(fd, "call_sheet"),
  };
  const supabase = await createClient();
  const { error } = id && isUuid(id) ? await supabase.from("playbook_plays").update(row).eq("id", id) : await supabase.from("playbook_plays").insert(row);
  if (error) return { error: friendlyDbError(error, "There's already a play with that name.") };
  refresh();
  return { error: null, saved: true };
}

export async function removePlay(fd: FormData) {
  const id = text(fd, "id");
  if ((await editorCheck()) || !isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("playbook_plays").delete().eq("id", id);
  refresh();
}

/** Put a play on the team's install checklist (so practices can cover it). */
export async function addPlayToInstall(fd: FormData) {
  const id = text(fd, "id");
  const teamId = text(fd, "team_id");
  if ((await editorCheck()) || !isUuid(id) || !isUuid(teamId)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("playbook_plays").select("name, category").eq("id", id).maybeSingle();
  if (!data) return;
  const play = data as { name: string; category: (typeof PLAY_CATEGORIES)[number] };
  await supabase.from("install_items").insert({
    team_id: teamId,
    category: "situation",
    group_name: PLAY_CATEGORY_LABEL[play.category].slice(0, 40),
    title: play.name,
    play_id: id,
    position: await nextPosition(supabase, "install_items", "team_id", teamId),
  });
  refresh();
}

// ---------------------------------------------------------------------------
// Team quizzes
// ---------------------------------------------------------------------------

export async function createQuiz(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  const title = text(fd, "title");
  if (!isUuid(teamId)) return { error: "Choose a team." };
  if (!title || title.length > 80) return { error: "Give the quiz a title, up to 80 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_quizzes").insert({ team_id: teamId, title }).select("id").single();
  if (error) return { error: friendlyDbError(error) };
  redirect(`/dugout/playbook/quizzes/${(data as { id: string }).id}`);
}

export async function addQuizQuestion(quizId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(quizId)) return { error: "Unknown quiz." };
  const question = text(fd, "question");
  const choices = parseChoices(String(fd.get("choices") ?? ""));
  const correct = wholeNumber(fd, "correct", 1, 5);
  const explanation = text(fd, "explanation");
  const playId = text(fd, "play_id");
  if (!question || question.length > 300) return { error: "Write the question, up to 300 characters." };
  if (!Array.isArray(choices)) return { error: choices.error };
  if (correct === null || correct === "invalid" || correct > choices.length) return { error: "Pick which choice is right." };
  if (explanation && explanation.length > 500) return { error: "Keep the explanation to 500 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("team_quiz_questions").insert({
    quiz_id: quizId,
    question,
    choices,
    correct_index: correct - 1,
    explanation,
    play_id: playId && isUuid(playId) ? playId : null,
    position: await nextPosition(supabase, "team_quiz_questions", "quiz_id", quizId),
  });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function removeQuizQuestion(fd: FormData) {
  const id = text(fd, "id");
  if ((await editorCheck()) || !isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("team_quiz_questions").delete().eq("id", id);
  refresh();
}

export async function publishQuiz(fd: FormData) {
  const id = text(fd, "id");
  const publish = text(fd, "publish") === "1";
  if ((await editorCheck()) || !isUuid(id)) return;
  const supabase = await createClient();
  if (publish) {
    const { count } = await supabase.from("team_quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", id);
    if (!count) return;
  }
  await supabase.from("team_quizzes").update({ published_at: publish ? new Date().toISOString() : null }).eq("id", id);
  refresh();
}

export async function deleteQuiz(fd: FormData) {
  const id = text(fd, "id");
  const teamId = text(fd, "team_id");
  if ((await editorCheck()) || !isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("team_quizzes").delete().eq("id", id);
  redirect(isUuid(teamId) ? `/dugout/playbook/quizzes?team=${teamId}` : "/dugout/playbook/quizzes");
}

// ---------------------------------------------------------------------------
// Scouting
// ---------------------------------------------------------------------------

/** The guided checklist: every answered prompt becomes a scouting report on that opponent. */
export async function saveScouting(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const opponent = text(fd, "opponent_id");
  const gameId = text(fd, "game_id");
  const observed = isoDate(fd, "observed_on");
  if (!isUuid(opponent)) return { error: "Choose the opponent." };

  const rows = [];
  for (const p of SCOUT_PROMPTS) {
    const body = text(fd, `a_${p.key}`);
    if (!body) continue;
    if (body.length > 1000) return { error: `“${p.title}” can be at most 1,000 characters.` };
    const confidence = wholeNumber(fd, `c_${p.key}`, 1, 5);
    rows.push({
      subject_team_id: opponent,
      game_id: gameId && isUuid(gameId) ? gameId : null,
      category: p.category,
      title: p.title,
      body,
      confidence: typeof confidence === "number" ? confidence : null,
      tags: ["checklist", p.key],
      observed_on: observed,
    });
  }
  if (rows.length === 0) return { error: "Answer at least one prompt." };
  const supabase = await createClient();
  const { error } = await supabase.from("scouting_reports").insert(rows);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

/** A free note on an opponent outside the checklist. */
export async function addScoutNote(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const opponent = text(fd, "opponent_id");
  const category = oneOf(fd, "category", SCOUT_CATEGORIES);
  const title = text(fd, "title");
  const body = text(fd, "body");
  if (!isUuid(opponent)) return { error: "Choose the opponent." };
  if (!category) return { error: "Pick a category." };
  if (!title || title.length > 80) return { error: "Give the note a title, up to 80 characters." };
  if (!body || body.length > 1000) return { error: "Write the note, up to 1,000 characters." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("scouting_reports")
    .insert({ subject_team_id: opponent, category, title, body, observed_on: isoDate(fd, "observed_on") });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function removeScoutReport(fd: FormData) {
  const id = text(fd, "id");
  if ((await editorCheck()) || !isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("scouting_reports").delete().eq("id", id);
  refresh();
}
