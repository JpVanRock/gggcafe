"use server";

// Goals: the Harada chart, SMART goals and which method she uses.
import { refresh } from "next/cache";
import { actForCheck, actorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { friendlyDbError, isoDate, oneOf, text, type FormState, invalid } from "@/lib/form";
import { GOAL_METHODS, SKILL_AREAS, isUuid, type GoalMethod } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";

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
  if (!main_goal) return invalid("main_goal", "Write the main goal first. It sits in the middle of the chart.");

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
  if (!title) return invalid("title", "Write the goal in a short sentence.");

  const metricKey = text(fd, "metric_key");
  const target = decimal(fd, "target_value");
  if (target === "invalid") return invalid("target_value", "The target should be a number, like 63 or 2.85.");
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

export async function setSmartGoalStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await actorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    const achieved = fd.get("status") === "achieved";
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase
      .from("development_goals")
      .update({ status: achieved ? "achieved" : "active", achieved_on: achieved ? todayISO() : null })
      .eq("id", id));
    refresh();
  });
}

export async function deleteSmartGoal(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await actorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("development_goals").delete().eq("id", id));
    refresh();
  });
}

// ---------------------------------------------------------------------------
