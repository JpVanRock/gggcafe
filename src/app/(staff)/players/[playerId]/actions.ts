"use server";

import { refresh } from "next/cache";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, isISODate, todayISO, weekStart } from "@/lib/dates";
import { friendlyDbError, isoDate, oneOf, text, type FormState } from "@/lib/form";
import { GOAL_METHODS, POSITIONS, SKILL_AREAS, isUuid, type GoalMethod } from "@/lib/softball";
import {
  TRAINING_CATEGORIES, categoriesFor, evaluateAchievements, type Check, type Routine,
} from "@/lib/achievements";
import type { TwisKind } from "./data";
import { MENTAL_FIELDS } from "./shared";

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
  const denied = await editorCheck();
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
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
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
  if (await editorCheck()) return;
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
  if (await editorCheck()) return;
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
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
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
  const denied = await editorCheck();
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
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };

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
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !GOAL_METHODS.includes(input.method)) return { error: "Unknown goal method." };

  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ goal_method: input.method }).eq("id", input.playerId);
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
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  const goalId = text(fd, "id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
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
  if (await editorCheck()) return;
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
  if (await editorCheck()) return;
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
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
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
// IQ Test
// ---------------------------------------------------------------------------

const IQ_TOPICS = ["general", "hitting", "pitching", "position"] as const;

/** Records a player's answer and returns the right answer with its explanation. */
export async function answerIqQuestion(input: {
  playerId: string;
  questionId: string;
  chosenIndex: number;
}): Promise<{ error: string | null; correct?: boolean; correctIndex?: number; explanation?: string | null }> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.playerId) || !isUuid(input.questionId) || !Number.isInteger(input.chosenIndex)) {
    return { error: "That answer couldn't be saved." };
  }

  const supabase = await createClient();
  const { data: q } = await supabase
    .from("iq_questions")
    .select("choices, correct_index, explanation")
    .eq("id", input.questionId)
    .maybeSingle();
  if (!q) return { error: "That question no longer exists." };
  if (input.chosenIndex < 0 || input.chosenIndex >= q.choices.length) return { error: "Pick one of the choices." };

  const correct = input.chosenIndex === q.correct_index;
  const { error } = await supabase.from("iq_answers").insert({
    player_id: input.playerId,
    question_id: input.questionId,
    chosen_index: input.chosenIndex,
    is_correct: correct,
    answered_on: todayISO(),
  });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, correct, correctIndex: q.correct_index, explanation: q.explanation };
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
