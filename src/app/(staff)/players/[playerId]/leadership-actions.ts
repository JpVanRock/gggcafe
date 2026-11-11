"use server";

// G3 Leadership Guide: coaches and admins pick leaders, rate them and sign off
// their plans; the player (or a coach) keeps her lessons and plan. The database
// enforces both (her work only with G3 Advanced and a coach's pick).
import { refresh } from "next/cache";
import { actForCheck, editorCheck, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import {
  CHECKIN_SOURCE, certificateProgram, checkInActivity, checkInChanges, cleanAnswer, cleanPlan, courseReady, findLesson, isProgram, planReady,
  validCoachRating, type LeadershipPlan, type Program,
} from "@/lib/leadership-guide";

type Result = { error: string | null };
type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Coaches and admins pick (or un-pick) a player to train as a leader, in the Full
 * Leadership Program or Leadership Light. Her work is always kept. Switching programs
 * puts her plan back to draft and clears the sign-off (each program is signed off on
 * its own); her certificate stays until she earns the next one.
 */
export async function setLeadershipAccess(input: { playerId: string; on: boolean; program?: Program }): Promise<Result> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.playerId)) return { error: "Unknown player." };
  const program = input.program ?? "full";
  if (!isProgram(program)) return { error: "Pick the Full Leadership Program or Leadership Light." };
  const supabase = await createClient();
  if (!input.on) {
    const { error } = await supabase.from("player_leadership_access").delete().eq("player_id", input.playerId);
    if (error) return { error: friendlyDbError(error) };
    refresh();
    return { error: null };
  }
  const { data: current } = await supabase.from("player_leadership_access").select("program").eq("player_id", input.playerId).maybeSingle();
  const { error } = await supabase.from("player_leadership_access").upsert({ player_id: input.playerId, program }, { onConflict: "player_id" });
  if (error) return { error: friendlyDbError(error) };
  if (current && current.program !== program) {
    const now = new Date().toISOString();
    const [plan, review] = await Promise.all([
      supabase.from("player_leadership_plans").update({ committed_at: null, updated_at: now }).eq("player_id", input.playerId),
      supabase.from("player_leadership_reviews").update({ signed_at: null, signed_by: null, updated_at: now }).eq("player_id", input.playerId),
    ]);
    const failed = plan.error ?? review.error;
    if (failed) return { error: friendlyDbError(failed) };
  }
  refresh();
  return { error: null };
}

async function currentLesson(supabase: Supabase, playerId: string, lesson: string) {
  const { data } = await supabase
    .from("player_leadership_lessons")
    .select("answers, steps, completed_at")
    .eq("player_id", playerId)
    .eq("lesson", lesson)
    .maybeSingle();
  return data as { answers: Record<string, string>; steps: string[]; completed_at: string | null } | null;
}

async function saveLesson(
  playerId: string,
  slug: string,
  change: (current: Awaited<ReturnType<typeof currentLesson>>) => Record<string, unknown> | string,
  refreshPage = false,
): Promise<Result> {
  const denied = await actForCheck(playerId);
  if (denied) return { error: denied };
  if (!isUuid(playerId) || !findLesson(slug)) return { error: "Unknown lesson." };
  const supabase = await createClient();
  const changes = change(await currentLesson(supabase, playerId, slug));
  if (typeof changes === "string") return { error: changes };
  const { error } = await supabase
    .from("player_leadership_lessons")
    .upsert({ player_id: playerId, lesson: slug, ...changes, updated_at: new Date().toISOString() }, { onConflict: "player_id,lesson" });
  if (error) return { error: friendlyDbError(error) };
  if (refreshPage) refresh();
  return { error: null };
}

/** One answer: a question, a habit (strength/growth), a self-rating (1-5) or a scenario note. */
export async function saveLeadershipAnswer(input: { playerId: string; lesson: string; key: string; value: string }): Promise<Result> {
  const lesson = findLesson(input.lesson);
  if (!lesson) return { error: "Unknown lesson." };
  const value = cleanAnswer(lesson, input.key, String(input.value ?? ""));
  if (value === null) return { error: "That answer couldn't be saved." };
  return saveLesson(input.playerId, input.lesson, (current) => {
    const answers = { ...(current?.answers ?? {}) };
    if (value) answers[input.key] = value;
    else delete answers[input.key];
    return { answers };
  });
}

/** A "try this" step, done or not. */
export async function setLeadershipStep(input: { playerId: string; lesson: string; step: string; done: boolean }): Promise<Result> {
  const lesson = findLesson(input.lesson);
  if (!lesson?.steps.some((s) => s.key === input.step)) return { error: "Unknown step." };
  return saveLesson(input.playerId, input.lesson, (current) => {
    const steps = new Set(current?.steps ?? []);
    if (input.done) steps.add(input.step);
    else steps.delete(input.step);
    return { steps: [...steps] };
  });
}

export async function setLeadershipLessonDone(input: { playerId: string; lesson: string; done: boolean }): Promise<Result> {
  return saveLesson(input.playerId, input.lesson, () => ({ completed_at: input.done ? new Date().toISOString() : null }), true);
}

/**
 * Her check-in dates as one-day reminders in her TWIS: adds new dates, removes
 * dropped ones, and leaves the rest alone (so a ticked-off check-in stays ticked).
 */
async function syncCheckIns(supabase: Supabase, playerId: string, plan: LeadershipPlan): Promise<string | null> {
  const { data } = await supabase.from("player_activities").select("id, starts_on").eq("player_id", playerId).eq("source", CHECKIN_SOURCE);
  const { add, remove } = checkInChanges(plan.checkIns ?? [], (data ?? []) as { id: string; starts_on: string }[]);
  if (remove.length) {
    const { error } = await supabase.from("player_activities").delete().in("id", remove);
    if (error) return friendlyDbError(error);
  }
  if (add.length) {
    const { error } = await supabase.from("player_activities").insert(add.map((d) => ({ player_id: playerId, ...checkInActivity(d) })));
    if (error) return friendlyDbError(error);
  }
  return null;
}

/** Her Leadership Plan (saving again after committing keeps the commitment). */
export async function saveLeadershipPlan(input: { playerId: string; plan: LeadershipPlan }): Promise<Result> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  if (!isUuid(input.playerId)) return { error: "Unknown player." };
  const supabase = await createClient();
  const plan = cleanPlan(input.plan ?? {});
  const { error } = await supabase
    .from("player_leadership_plans")
    .upsert({ player_id: input.playerId, plan, updated_at: new Date().toISOString() }, { onConflict: "player_id" });
  if (error) return { error: friendlyDbError(error) };
  return { error: await syncCheckIns(supabase, input.playerId, plan) };
}

/** She commits to her plan (it needs her why, a habit and a goal first). */
export async function commitLeadershipPlan(input: { playerId: string; plan: LeadershipPlan }): Promise<Result> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  const plan = cleanPlan(input.plan ?? {});
  if (!isUuid(input.playerId)) return { error: "Unknown player." };
  if (!planReady(plan)) return { error: "Write why you lead, at least one habit and one goal before you commit." };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("player_leadership_plans")
    .upsert({ player_id: input.playerId, plan, committed_at: now, updated_at: now }, { onConflict: "player_id" });
  if (error) return { error: friendlyDbError(error) };
  const reminders = await syncCheckIns(supabase, input.playerId, plan);
  if (reminders) return { error: reminders };
  refresh();
  return { error: null };
}

async function saveReview(playerId: string, change: (current: { ratings: Record<string, string> } | null) => Record<string, unknown>): Promise<Result> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("player_leadership_reviews").select("ratings").eq("player_id", playerId).maybeSingle();
  const { error } = await supabase
    .from("player_leadership_reviews")
    .upsert(
      { player_id: playerId, ...change(current as { ratings: Record<string, string> } | null), updated_at: new Date().toISOString() },
      { onConflict: "player_id" },
    );
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/** Coaches rate her on the same rubric she rates herself on. */
export async function saveCoachRating(input: { playerId: string; key: string; value: string }): Promise<Result> {
  if (!validCoachRating(input.key, input.value)) return { error: "Unknown rating." };
  return saveReview(input.playerId, (current) => {
    const ratings = { ...(current?.ratings ?? {}) };
    if (input.value) ratings[input.key] = input.value;
    else delete ratings[input.key];
    return { ratings };
  });
}

/**
 * Coaches sign off a finished course (every lesson of her program done, plan committed):
 * that awards her Certificate of Leadership and the Leader Badge. Taking the sign-off
 * back takes them back too.
 */
export async function signLeadershipPlan(input: { playerId: string; signed: boolean }): Promise<Result> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.playerId)) return { error: "Unknown player." };
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const [{ data: pick }, { data: held }] = await Promise.all([
    supabase.from("player_leadership_access").select("program").eq("player_id", input.playerId).maybeSingle(),
    supabase.from("player_leadership_certificates").select("program").eq("player_id", input.playerId).maybeSingle(),
  ]);
  const program: Program = isProgram(pick?.program) ? pick.program : "full";
  if (input.signed) {
    const [{ data: lessons }, { data: plan }] = await Promise.all([
      supabase.from("player_leadership_lessons").select("lesson, completed_at").eq("player_id", input.playerId),
      supabase.from("player_leadership_plans").select("committed_at").eq("player_id", input.playerId).maybeSingle(),
    ]);
    const work = ((lessons ?? []) as { lesson: string; completed_at: string | null }[]).map((l) => ({
      lesson: l.lesson,
      answers: {},
      steps: [],
      completedAt: l.completed_at,
    }));
    if (!courseReady(work, (plan?.committed_at as string | null | undefined) ?? null, program))
      return { error: "She needs every lesson complete and her plan committed before you sign off." };
  }
  const result = await saveReview(input.playerId, () => ({
    signed_at: input.signed ? new Date().toISOString() : null,
    signed_by: input.signed ? (user.user?.id ?? null) : null,
  }));
  if (result.error) return result;
  if (!input.signed) {
    const { error } = await supabase.from("player_leadership_certificates").delete().eq("player_id", input.playerId);
    return { error: error ? friendlyDbError(error) : null };
  }
  const { error } = await supabase
    .from("player_leadership_certificates")
    .upsert(
      {
        player_id: input.playerId,
        program: certificateProgram(program, isProgram(held?.program) ? held.program : null),
        team_id: await currentOwnTeam(supabase, input.playerId),
        awarded_at: new Date().toISOString(),
        awarded_by: user.user?.id ?? null,
        coach_name: (await getCurrentUser())?.staff?.displayName ?? null,
      },
      { onConflict: "player_id" },
    );
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}

/** Her team for the certificate's logo: an active spot on one of our teams, latest season first. */
async function currentOwnTeam(supabase: Supabase, playerId: string): Promise<string | null> {
  const { data } = await supabase
    .from("roster_entries")
    .select("team_id, active, team:teams(is_own_team), season:seasons(start_date)")
    .eq("player_id", playerId);
  const rows = ((data ?? []) as { team_id: string; active: boolean; team: { is_own_team: boolean } | null; season: { start_date: string | null } | null }[])
    .filter((r) => r.team?.is_own_team)
    .sort((a, b) => Number(b.active) - Number(a.active) || (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? ""));
  return rows[0]?.team_id ?? null;
}
