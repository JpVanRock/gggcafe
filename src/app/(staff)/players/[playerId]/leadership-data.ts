// G3 Leadership Guide: is she in it (G3 Advanced + a coach's pick), and her work.
import type { createClient } from "@/lib/supabase/server";
import { isProgram, type LeadershipPlan, type LessonWork, type Program } from "@/lib/leadership-guide";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type LeadershipData = {
  /** a coach or admin picked her to train as a leader */
  picked: boolean;
  /** the program the coach picked: Full or Leadership Light (Full when not picked) */
  program: Program;
  /** picked AND she has G3 Advanced: the guide is open */
  open: boolean;
  work: LessonWork[];
  plan: LeadershipPlan;
  committedAt: string | null;
  review: { ratings: Record<string, string>; signedAt: string | null };
};

export async function loadLeadership(supabase: Supabase, playerId: string, hasAdvanced: boolean): Promise<LeadershipData> {
  const { data: pick } = await supabase.from("player_leadership_access").select("program").eq("player_id", playerId).maybeSingle();
  const program: Program = isProgram(pick?.program) ? pick.program : "full";
  const empty = { work: [], plan: {}, committedAt: null, review: { ratings: {}, signedAt: null } };
  if (!pick || !hasAdvanced) return { picked: Boolean(pick), program, open: false, ...empty };
  const [{ data: lessons }, { data: plan }, { data: review }] = await Promise.all([
    supabase.from("player_leadership_lessons").select("lesson, answers, steps, completed_at").eq("player_id", playerId),
    supabase.from("player_leadership_plans").select("plan, committed_at").eq("player_id", playerId).maybeSingle(),
    supabase.from("player_leadership_reviews").select("ratings, signed_at").eq("player_id", playerId).maybeSingle(),
  ]);
  return {
    picked: true,
    program,
    open: true,
    work: ((lessons ?? []) as { lesson: string; answers: Record<string, string>; steps: string[]; completed_at: string | null }[]).map((l) => ({
      lesson: l.lesson,
      answers: l.answers ?? {},
      steps: l.steps ?? [],
      completedAt: l.completed_at,
    })),
    plan: ((plan?.plan as LeadershipPlan | undefined) ?? {}) as LeadershipPlan,
    committedAt: (plan?.committed_at as string | null | undefined) ?? null,
    review: { ratings: ((review?.ratings as Record<string, string> | undefined) ?? {}) as Record<string, string>, signedAt: (review?.signed_at as string | null | undefined) ?? null },
  };
}

/** Her Certificate of Leadership, if she has one. Only coaches/admins and the player herself can read it (RLS). */
export type LeaderCertificate = {
  /** the program it was earned in */
  program: Program;
  awardedAt: string;
  coachName: string | null;
  team: { id: string; name: string; logo_path: string | null } | null;
};

export async function loadLeaderCertificate(supabase: Supabase, playerId: string): Promise<LeaderCertificate | null> {
  const { data } = await supabase
    .from("player_leadership_certificates")
    .select("program, awarded_at, coach_name, team:teams(id, name, logo_path)")
    .eq("player_id", playerId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { program: string; awarded_at: string; coach_name: string | null; team: LeaderCertificate["team"] };
  return { program: isProgram(row.program) ? row.program : "full", awardedAt: row.awarded_at, coachName: row.coach_name, team: row.team };
}
