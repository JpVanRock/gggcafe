"use server";

// Coaches Dugout → Training: the Team Hitting Philosophy and the Throwing Program
// (user, 2026-11-12). Head coaches and admins write them; the database checks again
// (head-coach write policies).
import { refresh } from "next/cache";
import { headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text, type FormState, invalid } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { PHILOSOPHY_STATEMENT_MAX, PROGRAM_INTRO_MAX, cleanSections, cleanSteps, isThrowGroup } from "@/lib/team-programs";

const all = (fd: FormData, name: string) => fd.getAll(name).map((v) => String(v));

export async function saveHittingPhilosophy(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const teamId = text(fd, "team_id");
    if (!isUuid(teamId)) return failed(STALE);
    const statement = text(fd, "statement");
    if (statement && statement.length > PHILOSOPHY_STATEMENT_MAX) return invalid("statement", `Keep the statement to ${PHILOSOPHY_STATEMENT_MAX} characters.`);
    const sections = cleanSections(all(fd, "section_title"), all(fd, "section_body"));
    const supabase = await createClient();
    must(await supabase.from("team_hitting_philosophy").upsert({ team_id: teamId, statement, sections }, { onConflict: "team_id" }));
    refresh();
  });
}

export async function saveThrowingProgram(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const teamId = text(fd, "team_id");
    const grp = fd.get("grp");
    if (!isUuid(teamId) || !isThrowGroup(grp)) return failed(STALE);
    const intro = text(fd, "intro");
    if (intro && intro.length > PROGRAM_INTRO_MAX) return invalid("intro", `Keep the intro to ${PROGRAM_INTRO_MAX} characters.`);
    const steps = cleanSteps(all(fd, "step_name"), all(fd, "step_dose"), all(fd, "step_cue"));
    const supabase = await createClient();
    must(await supabase.from("team_throwing_programs").upsert({ team_id: teamId, grp, intro, steps }, { onConflict: "team_id,grp" }));
    refresh();
  });
}
