"use server";

// How to Keep the Book: lesson progress and the Keep the Book games.
import { refresh } from "next/cache";
import { actForCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { CHAPTERS, type BoxMarks } from "@/lib/scorebook";
import { GAME_COUNT, GAME_PLAYS, canonicalMarks } from "@/lib/scorebook-game";

// ---------------------------------------------------------------------------
// How to Keep the Book: lesson progress (the quizzes use the test flow above)
// ---------------------------------------------------------------------------

/** Saves the furthest lesson step she has reached in a chapter (never moves backward). */
export async function saveScorebookStep(input: { playerId: string; chapter: number; step: number }): Promise<{ error: string | null }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  const chapter = CHAPTERS.find((c) => c.n === input.chapter);
  if (!isUuid(input.playerId) || !chapter || !Number.isInteger(input.step) || input.step < 0 || input.step >= chapter.steps.length) {
    return { error: "That step couldn't be saved." };
  }
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("player_scorebook_progress")
    .select("step")
    .eq("player_id", input.playerId)
    .eq("chapter", chapter.n)
    .maybeSingle();
  if (current && (current.step as number) >= input.step) return { error: null };
  const { error } = await supabase
    .from("player_scorebook_progress")
    .upsert({ player_id: input.playerId, chapter: chapter.n, step: input.step, updated_at: new Date().toISOString() }, { onConflict: "player_id,chapter" });
  return { error: error ? friendlyDbError(error) : null };
}

/** Marks a chapter's lessons finished, which opens its quiz. */
export async function finishScorebookLessons(input: { playerId: string; chapter: number }): Promise<{ error: string | null }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  const chapter = CHAPTERS.find((c) => c.n === input.chapter);
  if (!isUuid(input.playerId) || !chapter) return { error: "Unknown chapter." };
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("player_scorebook_progress")
    .select("completed_at")
    .eq("player_id", input.playerId)
    .eq("chapter", chapter.n)
    .maybeSingle();
  if (current?.completed_at) return { error: null };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("player_scorebook_progress")
    .upsert(
      { player_id: input.playerId, chapter: chapter.n, step: chapter.steps.length - 1, completed_at: now, updated_at: now },
      { onConflict: "player_id,chapter" },
    );
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// How to Keep the Book: the extra-credit game (graded in the database)
// ---------------------------------------------------------------------------

export type GameRun = { id: string; game: number; nextPlay: number; firstTry: number; tries: number; book: Record<string, BoxMarks> };

function toGameRun(row: { id: string; game: number; next_play: number; first_try: number; tries: number; book: Record<string, BoxMarks> }): GameRun {
  return { id: row.id, game: row.game, nextPlay: row.next_play, firstTry: row.first_try, tries: row.tries, book: row.book ?? {} };
}

/** Starts a game, or resumes its open run (restart deals a fresh one). Game 1 opens after all six chapters; each next game after a clean book. */
export async function startScorebookGame(input: { playerId: string; game: number; restart?: boolean }): Promise<{ error: string | null; run?: GameRun }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !Number.isInteger(input.game) || input.game < 1 || input.game > GAME_COUNT) return { error: "Unknown game." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_scorebook_game", {
    p_player_id: input.playerId,
    p_game: input.game,
    p_restart: Boolean(input.restart),
  });
  if (error) {
    if (error.code === "P0001") return { error: "Finish all six chapters to unlock the games." };
    if (error.code === "P0004") return { error: `Game ${input.game} opens after a clean book in game ${input.game - 1}.` };
    return { error: friendlyDbError(error) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as Parameters<typeof toGameRun>[0];
  return { error: null, run: toGameRun(row) };
}

/** Grades one batter: the full state of every box she wrote in. */
export async function scoreGamePlay(input: {
  playerId: string;
  runId: string;
  play: number;
  boxes: Record<string, BoxMarks>;
}): Promise<{ error: string | null; correct?: boolean; wrong?: string[]; answer?: Record<string, BoxMarks> | null; nextPlay?: number; firstTry?: number }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.runId) || !Number.isInteger(input.play) || input.play < 1 || input.play > GAME_PLAYS) return { error: "That play couldn't be scored." };
  const boxes = Object.fromEntries(
    Object.entries(input.boxes ?? {})
      .filter(([id]) => /^[VH][1-9]-[12]$/.test(id))
      .map(([id, m]) => [id, canonicalMarks(m)]),
  );
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("score_game_play", { p_run_id: input.runId, p_play: input.play, p_boxes: boxes });
  if (error) {
    if (error.code === "P0008") return { error: "That batter isn't up. Reload the page to pick up where the book stands." };
    return { error: friendlyDbError(error) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    correct: boolean;
    wrong: string[];
    answer: Record<string, BoxMarks> | null;
    next_play: number;
    first_try: number;
  };
  return { error: null, correct: row.correct, wrong: row.wrong ?? [], answer: row.answer, nextPlay: row.next_play, firstTry: row.first_try };
}

/** The final line score. Right: the run ends, and a clean book earns the surprise. */
export async function finishScorebookGame(input: {
  playerId: string;
  runId: string;
  line: { V: number[]; H: number[] };
}): Promise<{ error: string | null; lineOk?: boolean; passed?: boolean; firstTry?: number; awardEarned?: boolean; allTenEarned?: boolean }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  const clean = (runs: unknown) =>
    Array.isArray(runs) && runs.length === 2 && runs.every((n) => Number.isInteger(n) && n >= 0 && n <= 30) ? (runs as number[]) : null;
  const V = clean(input.line?.V);
  const H = clean(input.line?.H);
  if (!isUuid(input.runId) || !V || !H) return { error: "Fill in the runs for each inning." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_scorebook_game", { p_run_id: input.runId, p_line: { V, H } });
  if (error) {
    if (error.code === "P0003") return { error: "Score every batter first." };
    return { error: friendlyDbError(error) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    line_ok: boolean;
    passed: boolean;
    first_try: number;
    award_earned: boolean;
    all_ten_earned: boolean;
  };
  if (row.line_ok) refresh();
  return {
    error: null,
    lineOk: row.line_ok,
    passed: row.passed,
    firstTry: row.first_try,
    awardEarned: row.award_earned,
    allTenEarned: row.all_ten_earned,
  };
}

// ---------------------------------------------------------------------------
