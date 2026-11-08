"use server";

import { refresh } from "next/cache";
import { actForCheck, actorCheck, editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, isISODate, todayISO, weekStart } from "@/lib/dates";
import { friendlyDbError, isoDate, oneOf, text, type FormState } from "@/lib/form";
import { FIELD_POSITIONS, GOAL_METHODS, POSITIONS, SKILL_AREAS, isUuid, type GoalMethod } from "@/lib/softball";
import {
  TRAINING_CATEGORIES, categoriesFor, evaluateAchievements, type Check, type Routine,
} from "@/lib/achievements";
import type { TwisKind } from "./data";
import { MENTAL_FIELDS } from "./shared";
import { HITTING, HITTING_KEYS, MOVEMENT, MOVEMENT_KEYS, changes, cleanValues, type Values } from "@/lib/movement";
import { CHAPTERS, type BoxMarks } from "@/lib/scorebook";
import { GAME_COUNT, GAME_PLAYS, canonicalMarks } from "@/lib/scorebook-game";

// ---------------------------------------------------------------------------
// TWIS check-offs
// ---------------------------------------------------------------------------

export async function setTwisCheck(input: {
  playerId: string;
  kind: TwisKind;
  refId: string;
  onDate: string;
  checked: boolean;
}): Promise<{ error: string | null }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  const { playerId, kind, refId, onDate, checked } = input;
  if (!isUuid(playerId) || !isUuid(refId) || !isISODate(onDate) || !["game", "event", "activity"].includes(kind)) {
    return { error: "That item couldn't be updated. Reload the page and try again." };
  }

  const column = kind === "game" ? "game_id" : kind === "event" ? "team_event_id" : "activity_id";
  const supabase = await createClient();

  if (checked) {
    const { error } = await supabase.from("twis_checks").insert({ player_id: playerId, [column]: refId, on_date: onDate });
    // Already ticked (another tab, a double click) is fine.
    if (error && error.code !== "23505") return { error: friendlyDbError(error) };
  } else {
    const { error } = await supabase
      .from("twis_checks")
      .delete()
      .eq("player_id", playerId)
      .eq(column, refId)
      .eq("on_date", onDate);
    if (error) return { error: friendlyDbError(error) };
  }

  if (kind === "activity" && checked) await awardAchievements(supabase, playerId);

  refresh();
  return { error: null };
}

// ---------------------------------------------------------------------------
// Activities the player commits to
// ---------------------------------------------------------------------------

export async function addActivity(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await actorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const notHers = await actForCheck(playerId);
  if (notHers) return { error: notHers };
  const title = text(fd, "title");
  if (!title) return { error: "Name the activity, e.g. “Tee work” or “Long toss”." };

  const days = fd
    .getAll("days")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  const starts_on = isoDate(fd, "starts_on") ?? weekStart(todayISO());
  const thisWeekOnly = fd.get("this_week_only") === "on";
  const ends_on = thisWeekOnly ? addDays(weekStart(starts_on), 6) : isoDate(fd, "ends_on");
  if (ends_on && ends_on < starts_on) return { error: "The end date is before the start date." };
  const pillarId = text(fd, "pillar_id");

  const supabase = await createClient();
  const { error } = await supabase.from("player_activities").insert({
    player_id: playerId,
    title,
    details: text(fd, "details"),
    days: [...new Set(days)].sort(),
    starts_on,
    ends_on,
    pillar_id: isUuid(pillarId) ? pillarId : null,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

/** Stop an ongoing activity from today on. Past check-offs stay. */
export async function endActivity(fd: FormData): Promise<void> {
  if (await actorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const today = todayISO();
  const { data } = await supabase.from("player_activities").select("starts_on").eq("id", id).maybeSingle();
  if (!data) return;
  // Ends yesterday, so it's gone from today on; one that hasn't started yet ends on its start date.
  const yesterday = addDays(today, -1);
  const endsOn = yesterday < data.starts_on ? data.starts_on : yesterday;
  await supabase.from("player_activities").update({ ends_on: endsOn }).eq("id", id);
  refresh();
}

/** Remove an activity entirely, with its check-offs (for ones added by mistake). */
export async function deleteActivity(fd: FormData): Promise<void> {
  if (await actorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("player_activities").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Goals (Harada Method)
// ---------------------------------------------------------------------------

export async function saveGoals(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await actorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const notHers = await actForCheck(playerId);
  if (notHers) return { error: notHers };
  const main_goal = text(fd, "main_goal");
  if (!main_goal) return { error: "Write the main goal first. It sits in the middle of the chart." };

  const pillars = Array.from({ length: 8 }, (_, i) => ({
    position: i + 1,
    title: text(fd, `pillar_${i + 1}`) ?? "",
    actions: Array.from({ length: 8 }, (_, j) => ({
      position: j + 1,
      title: text(fd, `pillar_${i + 1}_action_${j + 1}`) ?? "",
    })).filter((a) => a.title),
  }));
  const orphan = pillars.find((p) => !p.title && p.actions.length > 0);
  if (orphan) return { error: `Area ${orphan.position} has actions but no name. Name it or clear its actions.` };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_harada_plan", {
    p_player_id: playerId,
    p_chart: {
      main_goal,
      purpose: text(fd, "purpose") ?? "",
      target_date: isoDate(fd, "target_date") ?? "",
      pillars: pillars.filter((p) => p.title),
    },
  });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

export async function setGoalActionDone(input: { actionId: string; done: boolean }): Promise<{ error: string | null }> {
  const denied = await actorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.actionId)) return { error: "Unknown action." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("harada_actions")
    .update({ done_on: input.done ? todayISO() : null })
    .eq("id", input.actionId);
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null };
}

// ---------------------------------------------------------------------------
// Mental GP
// ---------------------------------------------------------------------------

export async function saveMentalPlan(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await actorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const notHers = await actForCheck(playerId);
  if (notHers) return { error: notHers };

  const values = Object.fromEntries(MENTAL_FIELDS.map((f) => [f.name, text(fd, f.name)]));
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const { error } = await supabase
    .from("mental_game_plans")
    .upsert({ player_id: playerId, ...values, updated_by: auth?.claims?.sub ?? null }, { onConflict: "player_id" });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

// ---------------------------------------------------------------------------
// Goal method + SMART goals
// ---------------------------------------------------------------------------

export async function setGoalMethod(input: { playerId: string; method: GoalMethod }): Promise<{ error: string | null }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !GOAL_METHODS.includes(input.method)) return { error: "Unknown goal method." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_goal_method", { p_player_id: input.playerId, p_method: input.method });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null };
}

function decimal(fd: FormData, name: string): number | null | "invalid" {
  const value = text(fd, name);
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) < 100000 ? n : "invalid";
}

/** Creates a SMART goal, or updates one when an id is sent. */
export async function saveSmartGoal(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await actorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  const goalId = text(fd, "id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const notHers = await actForCheck(playerId);
  if (notHers) return { error: notHers };
  const title = text(fd, "title");
  if (!title) return { error: "Write the goal in a short sentence." };

  const metricKey = text(fd, "metric_key");
  const target = decimal(fd, "target_value");
  if (target === "invalid") return { error: "The target should be a number, like 63 or 2.85." };
  if (target !== null && !metricKey) return { error: "Pick which measurement the target is for." };

  const values = {
    title,
    area: oneOf(fd, "area", SKILL_AREAS) ?? "other",
    specific: text(fd, "specific"),
    measurable: text(fd, "measurable"),
    achievable: text(fd, "achievable"),
    relevant: text(fd, "relevant"),
    target_date: isoDate(fd, "target_date"),
    metric_key: metricKey && target !== null ? metricKey : null,
    target_value: metricKey ? target : null,
  };

  const supabase = await createClient();
  if (isUuid(goalId)) {
    const { data, error } = await supabase.from("development_goals").update(values).eq("id", goalId).select("id");
    if (error) return { error: friendlyDbError(error) };
    if (!data?.length) return { error: "That goal no longer exists." };
  } else {
    // Starting point for a measurable target: the player's latest measurement, if any.
    let baseline: number | null = null;
    if (values.metric_key) {
      const { data } = await supabase
        .from("player_metric_progress")
        .select("latest_value")
        .eq("player_id", playerId)
        .eq("metric_key", values.metric_key)
        .maybeSingle();
      baseline = data?.latest_value ?? null;
    }
    const { error } = await supabase
      .from("development_goals")
      .insert({ ...values, player_id: playerId, baseline_value: baseline });
    if (error) return { error: friendlyDbError(error) };
  }

  refresh();
  return { error: null, saved: true };
}

export async function setSmartGoalStatus(fd: FormData): Promise<void> {
  if (await actorCheck()) return;
  const id = text(fd, "id");
  const achieved = fd.get("status") === "achieved";
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase
    .from("development_goals")
    .update({ status: achieved ? "achieved" : "active", achieved_on: achieved ? todayISO() : null })
    .eq("id", id);
  refresh();
}

export async function deleteSmartGoal(fd: FormData): Promise<void> {
  if (await actorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("development_goals").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Performance Training
// ---------------------------------------------------------------------------

function httpUrl(fd: FormData, name: string): string | null | "invalid" {
  const value = text(fd, name);
  if (value === null) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "invalid";
  } catch {
    return "invalid";
  }
}

/** Adds a training routine (from the drill library, or a new drill) on chosen days. */
export async function addRoutine(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await actorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const notHers = await actForCheck(playerId);
  if (notHers) return { error: notHers };
  const category = oneOf(fd, "category", TRAINING_CATEGORIES);
  if (!category) return { error: "Unknown training category." };

  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("primary_position, secondary_positions")
    .eq("id", playerId)
    .maybeSingle();
  if (!player) return { error: "Unknown player." };
  const positions = [player.primary_position, ...(player.secondary_positions ?? [])].filter(Boolean);
  if (!categoriesFor(positions).includes(category)) {
    return { error: category === "pitching" ? "Pitching drills are for pitchers." : "Catching drills are for catchers." };
  }

  let drillId = text(fd, "drill_id");
  let title: string | null = null;
  if (isUuid(drillId)) {
    const { data: drill } = await supabase.from("drills").select("name").eq("id", drillId).maybeSingle();
    if (!drill) return { error: "That drill is no longer in the library." };
    title = drill.name;
  } else {
    title = text(fd, "new_name");
    const description = text(fd, "new_description");
    if (!title) return { error: "Choose from the library, or name the new routine." };
    if (!description) return { error: "Describe the new routine in a sentence so the player knows what to do." };
    const video_url = httpUrl(fd, "new_video_url");
    if (video_url === "invalid") return { error: "The video link should start with https://" };
    const AREA: Record<string, string> = {
      workout: "strength_conditioning", stretching: "strength_conditioning", hitting: "hitting",
      fielding: "infield", pitching: "pitching", catching: "catching",
    };
    const { data, error } = await supabase
      .from("drills")
      .insert({ name: title, area: AREA[category], category, description, equipment: text(fd, "new_equipment"), video_url })
      .select("id")
      .single();
    if (error) return { error: friendlyDbError(error, `There's already a drill called “${title}”. Pick it from the library instead.`) };
    drillId = data.id;
  }

  const days = fd.getAll("days").map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  const { error } = await supabase.from("player_activities").insert({
    player_id: playerId,
    title,
    details: text(fd, "prescription"),
    days: [...new Set(days)].sort(),
    starts_on: isoDate(fd, "starts_on") ?? todayISO(),
    category,
    drill_id: drillId,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

/** Stores any achievements the player has newly earned. Earned ones are never removed. */
async function awardAchievements(supabase: Awaited<ReturnType<typeof createClient>>, playerId: string) {
  const [{ data: player }, { data: routines }] = await Promise.all([
    supabase.from("players").select("primary_position, secondary_positions").eq("id", playerId).maybeSingle(),
    supabase.from("player_activities").select("id, category, days, starts_on, ends_on").eq("player_id", playerId).not("category", "is", null),
  ]);
  if (!player || !routines?.length) return;
  const { data: checks } = await supabase
    .from("twis_checks")
    .select("activity_id, on_date")
    .in("activity_id", routines.map((r) => r.id));
  const unlocked = evaluateAchievements({
    routines: routines as Routine[],
    checks: (checks ?? []) as Check[],
    today: todayISO(),
    positions: [player.primary_position, ...(player.secondary_positions ?? [])].filter(Boolean),
  }).filter((p) => p.unlockedOn);
  if (unlocked.length === 0) return;
  await supabase.from("player_achievements").upsert(
    unlocked.map((p) => ({ player_id: playerId, achievement_key: p.def.key, unlocked_on: p.unlockedOn })),
    { onConflict: "player_id,achievement_key", ignoreDuplicates: true },
  );
}

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

export async function setIqQuestionActive(fd: FormData): Promise<void> {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("iq_questions").update({ active: fd.get("active") === "true" }).eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// IQ playbook levels (Defense IQ, Baserunning IQ) and rings
// ---------------------------------------------------------------------------

const IQ_TRACKS = ["defense", "baserunning", "position", "extra", "scorebook"] as const;

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
    p_track: input.track,
    p_level: input.level,
    p_restart: Boolean(input.restart),
    p_position: position,
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

// ---------------------------------------------------------------------------
// Movement Preferences (coaches) and Preferred Hitting Style (player or coach).
// Every save is a new version, so the history is kept.
// ---------------------------------------------------------------------------

function formValues(fd: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, text(fd, k)]));
}

export async function saveMovement(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const values = cleanValues(MOVEMENT, formValues(fd, MOVEMENT_KEYS));
  const supabase = await createClient();
  // Movement Preferences is G3 Advanced (user, 2026-11-08)
  const { data: g3 } = await supabase.from("player_advanced_access").select("player_id").eq("player_id", playerId).maybeSingle();
  if (!g3) return { error: "Movement Preferences is a G3 Advanced feature. Unlock G3 Advanced for her first." };
  const { data: latest } = await supabase
    .from("movement_preferences")
    .select(MOVEMENT_KEYS.join(", "))
    .eq("player_id", playerId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && changes(MOVEMENT, latest as unknown as Values, values).length === 0) return { error: null, saved: true };
  const { error } = await supabase.from("movement_preferences").insert({ player_id: playerId, ...values });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function saveHittingStyle(_prev: FormState, fd: FormData): Promise<FormState> {
  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const denied = await actForCheck(playerId);
  if (denied) return { error: denied };
  const values = cleanValues(HITTING, formValues(fd, HITTING_KEYS));
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("hitting_styles")
    .select(HITTING_KEYS.join(", "))
    .eq("player_id", playerId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && changes(HITTING, latest as unknown as Values, values).length === 0) return { error: null, saved: true };
  const { error } = await supabase.from("hitting_styles").insert({ player_id: playerId, ...values });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}
