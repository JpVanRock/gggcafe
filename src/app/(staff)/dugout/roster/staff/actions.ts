"use server";

import { refresh } from "next/cache";
import { headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nextPosition } from "@/lib/db";
import { friendlyDbError, oneOf, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { DUTY_PHASES, STARTER_COMMITMENT, STARTER_DUTIES, STARTER_PRE_PRACTICE, cleanLines } from "@/lib/staff-duties";
import { STALE, failed, must, runAction } from "@/lib/actions";

/** Load the starter matrix (skipping duties the team already has) and starter standards if none yet. */
export async function loadStarterDuties(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const teamId = text(fd, "team_id");
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    if (!isUuid(teamId)) return failed(STALE);
    const supabase = await createClient();
    const [{ data }, { data: standards }] = await Promise.all([
      supabase.from("staff_duties").select("phase, duty, position").eq("team_id", teamId),
      supabase.from("staff_standards").select("team_id").eq("team_id", teamId).maybeSingle(),
    ]);
    const rows = (data ?? []) as { phase: string; duty: string; position: number }[];
    const have = new Set(rows.map((r) => `${r.phase}|${r.duty}`));
    let position = Math.max(-1, ...rows.map((r) => r.position)) + 1;
    const add = STARTER_DUTIES.filter((d) => !have.has(`${d.phase}|${d.duty}`)).map((d) => ({ team_id: teamId, phase: d.phase, duty: d.duty, position: position++ }));
    if (add.length) await supabase.from("staff_duties").insert(add);
    if (!standards) await supabase.from("staff_standards").insert({ team_id: teamId, commitment: STARTER_COMMITMENT, pre_practice: STARTER_PRE_PRACTICE });
    refresh();
  });
}

/** Save the matrix's owners (owner_<id> fields): only the ones that changed (was_<id>), all at once. */
export async function saveDutyOwners(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const updates: { id: string; owner: string | null }[] = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("owner_") || typeof value !== "string") continue;
    const id = key.slice(6);
    const owner = value.trim() || null;
    if (owner && owner.length > 60) return { error: "Keep each name to 60 characters." };
    const was = fd.get(`was_${id}`);
    if (isUuid(id) && (typeof was !== "string" || (was.trim() || null) !== owner)) updates.push({ id, owner });
  }
  const supabase = await createClient();
  const results = await Promise.all(updates.map((u) => supabase.from("staff_duties").update({ owner: u.owner }).eq("id", u.id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: friendlyDbError(failed.error) };
  refresh();
  return { error: null, saved: true };
}

export async function addDuty(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  const phase = oneOf(fd, "phase", DUTY_PHASES);
  const duty = text(fd, "duty");
  const owner = text(fd, "owner");
  if (!isUuid(teamId) || !phase) return { error: "Pick when the job happens." };
  if (!duty || duty.length > 60) return { error: "Name the job, up to 60 characters." };
  if (owner && owner.length > 60) return { error: "Keep the name to 60 characters." };
  const supabase = await createClient();
  const position = await nextPosition(supabase, "staff_duties", "team_id", teamId);
  const { error } = await supabase.from("staff_duties").insert({ team_id: teamId, phase, duty, owner, position });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function removeDuty(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const id = text(fd, "remove");
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("staff_duties").delete().eq("id", id));
    refresh();
  });
}

export async function saveStaffStandards(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  if (!isUuid(teamId)) return { error: "Choose a team." };
  const commitment = cleanLines(String(fd.get("commitment") ?? ""), 12, 200);
  const prePractice = cleanLines(String(fd.get("pre_practice") ?? ""), 15, 120);
  if (!Array.isArray(commitment)) return { error: `Staff commitment: ${commitment.error}` };
  if (!Array.isArray(prePractice)) return { error: `Pre-practice checklist: ${prePractice.error}` };
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_standards")
    .upsert({ team_id: teamId, commitment, pre_practice: prePractice, updated_at: new Date().toISOString() });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}
