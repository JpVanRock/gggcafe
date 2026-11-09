"use server";

// Softball IQ: practice questions and the question bank, level tests, and reviewing misses.
import { refresh } from "next/cache";
import { actForCheck, actorCheck, editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, oneOf, text, type FormState } from "@/lib/form";
import { FIELD_POSITIONS, POSITIONS, isUuid } from "@/lib/softball";
import type { Enums } from "@/lib/supabase/database.types";
import { CHAPTERS } from "@/lib/scorebook";
import { STALE, failed, must, runAction } from "@/lib/actions";

// ---------------------------------------------------------------------------
// Softball IQ (practice quizzes, level and position tests, Extra Credit)
// ---------------------------------------------------------------------------

const IQ_TOPICS = ["general", "hitting", "pitching", "position"] as const;

type Graded = { correct: boolean; correct_index: number; explanation: string | null };

/** Records and grades one answer in the database (record_iq_answer), so it can't be faked. */
async function recordAnswer(args: {
  playerId: string;
  questionId: string;
  chosenIndex: number;
  attemptId?: string;
  reviewOf?: string;
  hintUsed?: boolean;
}): Promise<{ error: string | null; graded?: Graded }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_iq_answer", {
    p_player_id: args.playerId,
    p_question_id: args.questionId,
    p_chosen: args.chosenIndex,
    p_attempt_id: args.attemptId ?? null,
    p_review_of: args.reviewOf ?? null,
    p_hint_used: Boolean(args.hintUsed),
  });
  if (error) {
    if (error.code === "23505") return { error: args.reviewOf ? "That question was already reviewed." : "That question was already answered in this test." };
    if (error.code === "P0008") return { error: error.message.charAt(0).toUpperCase() + error.message.slice(1) + "." };
    if (error.code === "P0002") return { error: "That question no longer exists." };
    if (error.code === "22023") return { error: "Pick one of the choices." };
    return { error: friendlyDbError(error) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as Graded | null;
  return row ? { error: null, graded: row } : { error: "That answer couldn't be saved." };
}

/** Records a player's answer and returns the right answer with its explanation. */
export async function answerIqQuestion(input: {
  playerId: string;
  questionId: string;
  chosenIndex: number;
}): Promise<{ error: string | null; correct?: boolean; correctIndex?: number; explanation?: string | null }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !isUuid(input.questionId) || !Number.isInteger(input.chosenIndex)) {
    return { error: "That answer couldn't be saved." };
  }
  const result = await recordAnswer(input);
  if (!result.graded) return { error: result.error };
  refresh();
  return { error: null, correct: result.graded.correct, correctIndex: result.graded.correct_index, explanation: result.graded.explanation };
}

/** Creates or updates a question in the shared bank. */
export async function saveIqQuestion(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const id = text(fd, "id");
  const topic = oneOf(fd, "topic", IQ_TOPICS) ?? "general";
  const position = topic === "position" ? oneOf(fd, "position", POSITIONS) : null;
  if (topic === "position" && !position) return { error: "Pick the position this question is for." };
  const scenario = text(fd, "scenario");
  const question = text(fd, "question");
  if (!scenario || !question) return { error: "Describe the game situation and ask the question." };

  // Keep the filled-in choices, remembering which one was marked correct.
  const filled = [0, 1, 2, 3, 4]
    .map((i) => ({ i, value: text(fd, `choice_${i}`) }))
    .filter((c): c is { i: number; value: string } => c.value !== null);
  if (filled.length < 2) return { error: "Give at least two answer choices." };
  const marked = Number(fd.get("correct"));
  const correct_index = filled.findIndex((c) => c.i === marked);
  if (correct_index < 0) return { error: "Mark which choice is correct." };

  const values = {
    topic,
    position,
    scenario,
    question,
    choices: filled.map((c) => c.value),
    correct_index,
    explanation: text(fd, "explanation"),
    difficulty: Math.min(3, Math.max(1, Number(fd.get("difficulty")) || 1)),
  };
  const supabase = await createClient();
  const { error } = isUuid(id)
    ? await supabase.from("iq_questions").update(values).eq("id", id)
    : await supabase.from("iq_questions").insert(values);
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

export async function setIqQuestionActive(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("iq_questions").update({ active: fd.get("active") === "true" }).eq("id", id));
    refresh();
  });
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// IQ playbook levels (Defense IQ, Baserunning IQ) and rings
// ---------------------------------------------------------------------------

const IQ_TRACKS = ["defense", "baserunning", "offense", "battery", "position", "extra", "scorebook"] as const;

/** A test question as sent to the browser: no answer. `section` is the library shelf (Extra Credit only). */
export type LevelQuestion = { id: string; scenario: string; question: string; choices: string[]; diagram: unknown; section: string | null };

/**
 * Starts a test, or resumes the open one where she left off (restart deals a
 * fresh one). Playbook tracks have Levels 1-3 (the database checks the level is
 * unlocked); the position track is one level per fielding position. Questions
 * come back in the dealt order, without answers, plus what's already answered.
 */
export async function startIqLevel(input: {
  playerId: string;
  track: string;
  level: number;
  restart?: boolean;
  position?: string | null;
}): Promise<{
  error: string | null;
  attemptId?: string;
  questions?: LevelQuestion[];
  answered?: Record<string, { correct: boolean }>;
}> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  const positionTest = input.track === "position";
  const course = input.track === "scorebook";
  const position = input.position ?? null;
  if (
    !isUuid(input.playerId) ||
    !(IQ_TRACKS as readonly string[]).includes(input.track) ||
    !(course ? CHAPTERS.some((c) => c.n === input.level) : [1, 2, 3].includes(input.level)) ||
    (positionTest ? input.level !== 1 || !(FIELD_POSITIONS as readonly string[]).includes(position ?? "") : position !== null) ||
    (input.track === "extra" && input.level !== 1)
  ) {
    return { error: positionTest ? "Choose a position." : "Unknown test." };
  }

  const supabase = await createClient();
  const { data: attemptId, error } = await supabase.rpc("start_iq_level", {
    p_player_id: input.playerId,
    // both were checked against IQ_TRACKS / FIELD_POSITIONS above
    p_track: input.track as Enums<"iq_track">,
    p_level: input.level,
    p_restart: Boolean(input.restart),
    p_position: position as Enums<"field_position"> | null,
  });
  if (error) {
    if (course && error.code === "P0001") return { error: `Chapter ${input.level} unlocks once Chapter ${input.level - 1} is complete.` };
    if (error.code === "P0005") return { error: "Finish the chapter's lessons first, then take the quiz." };
    if (error.code === "P0001") return { error: `Level ${input.level} unlocks after passing Level ${input.level - 1} with 80% or better.` };
    if (error.code === "P0002") return { error: positionTest ? "This position has no questions yet." : "This test has no questions yet." };
    return { error: friendlyDbError(error) };
  }

  const [{ data: attempt }, { data: given }] = await Promise.all([
    supabase.from("iq_level_attempts").select("question_order").eq("id", attemptId).single(),
    supabase.from("iq_answers").select("question_id, is_correct").eq("attempt_id", attemptId),
  ]);
  const order = (attempt?.question_order ?? []) as string[];
  const { data: rows } = await supabase.from("iq_questions").select("id, scenario, question, choices, diagram, section").in("id", order);
  const byId = new Map(((rows ?? []) as LevelQuestion[]).map((q) => [q.id, q]));
  const answered = Object.fromEntries(((given ?? []) as { question_id: string; is_correct: boolean }[]).map((g) => [g.question_id, { correct: g.is_correct }]));

  return {
    error: null,
    attemptId: attemptId as string,
    questions: order.map((id) => byId.get(id)).filter((q): q is LevelQuestion => Boolean(q)),
    answered,
  };
}

/** Records one answer in a test and returns the right answer with its explanation. */
export async function answerIqLevelQuestion(input: {
  playerId: string;
  attemptId: string;
  questionId: string;
  chosenIndex: number;
  /** Extra Credit allows a hint before answering */
  hintUsed?: boolean;
}): Promise<{ error: string | null; correct?: boolean; correctIndex?: number; explanation?: string | null }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !isUuid(input.attemptId) || !isUuid(input.questionId) || !Number.isInteger(input.chosenIndex)) {
    return { error: "That answer couldn't be saved." };
  }
  const result = await recordAnswer(input);
  if (!result.graded) return { error: result.error };
  return { error: null, correct: result.graded.correct, correctIndex: result.graded.correct_index, explanation: result.graded.explanation };
}

/** Grades a test; 80%+ earns the award (ring, Golden Glove, or Champions Trophy). A perfect score earns the MVP badge too. */
export async function finishIqLevel(input: {
  attemptId: string;
}): Promise<{ error: string | null; correct?: number; total?: number; passed?: boolean; awardEarned?: boolean }> {
  const denied = await actorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.attemptId)) return { error: "Unknown test." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_iq_level", { p_attempt_id: input.attemptId });
  if (error) {
    if (error.code === "P0003") return { error: "Answer every library question before grading the run." };
    return { error: friendlyDbError(error) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { correct: number; total: number; passed: boolean; award_earned: boolean };

  refresh();
  return { error: null, correct: row.correct, total: row.total, passed: row.passed, awardEarned: row.award_earned };
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reviewing missed questions after a level test
// ---------------------------------------------------------------------------

/** The questions a finished test missed (wrong or unanswered), plus which have been reviewed. */
export async function startIqReview(input: {
  playerId: string;
  attemptId: string;
}): Promise<{ error: string | null; questions?: LevelQuestion[]; reviewed?: Record<string, { correct: boolean }> }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !isUuid(input.attemptId)) return { error: "Unknown test." };

  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("iq_level_attempts")
    .select("player_id, finished_at, question_order")
    .eq("id", input.attemptId)
    .maybeSingle();
  if (!attempt || attempt.player_id !== input.playerId || !attempt.finished_at) return { error: "That test isn't finished yet." };

  const order = (attempt.question_order ?? []) as string[];
  const [{ data: right }, { data: reviews }] = await Promise.all([
    supabase.from("iq_answers").select("question_id").eq("attempt_id", input.attemptId).eq("is_correct", true),
    supabase.from("iq_answers").select("question_id, is_correct").eq("review_of", input.attemptId),
  ]);
  const gotRight = new Set(((right ?? []) as { question_id: string }[]).map((r) => r.question_id));
  const missed = order.filter((id) => !gotRight.has(id));
  if (missed.length === 0) return { error: "Nothing to review: every question was answered correctly." };

  const { data: rows } = await supabase.from("iq_questions").select("id, scenario, question, choices, diagram, section").in("id", missed);
  const byId = new Map(((rows ?? []) as LevelQuestion[]).map((q) => [q.id, q]));
  return {
    error: null,
    questions: missed.map((id) => byId.get(id)).filter((q): q is LevelQuestion => Boolean(q)),
    reviewed: Object.fromEntries(((reviews ?? []) as { question_id: string; is_correct: boolean }[]).map((r) => [r.question_id, { correct: r.is_correct }])),
  };
}

/** A hint for one question, shown when the player asks for it during review. */
export async function getIqHint(input: { questionId: string }): Promise<{ error: string | null; hint?: string }> {
  const denied = await actorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.questionId)) return { error: "Unknown question." };
  const supabase = await createClient();
  const { data } = await supabase.from("iq_questions").select("hint").eq("id", input.questionId).maybeSingle();
  return { error: null, hint: data?.hint ?? "Picture where every runner is and what happens if you get it wrong." };
}

/** Records a review answer and returns the right answer, its explanation, and review progress. */
export async function answerIqReviewQuestion(input: {
  playerId: string;
  attemptId: string;
  questionId: string;
  chosenIndex: number;
  hintUsed: boolean;
}): Promise<{
  error: string | null;
  correct?: boolean;
  correctIndex?: number;
  explanation?: string | null;
  complete?: boolean;
}> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !isUuid(input.attemptId) || !isUuid(input.questionId) || !Number.isInteger(input.chosenIndex)) {
    return { error: "That answer couldn't be saved." };
  }
  const result = await recordAnswer({ ...input, attemptId: undefined, reviewOf: input.attemptId });
  if (!result.graded) return { error: result.error };

  const supabase = await createClient();
  const { data: status } = await supabase.rpc("iq_review_status", { p_attempt_id: input.attemptId });
  const row = (Array.isArray(status) ? status[0] : status) as { complete: boolean } | null;
  refresh();
  return {
    error: null,
    correct: result.graded.correct,
    correctIndex: result.graded.correct_index,
    explanation: result.graded.explanation,
    complete: Boolean(row?.complete),
  };
}
