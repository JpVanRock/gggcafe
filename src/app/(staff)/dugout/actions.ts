"use server";

import { refresh } from "next/cache";
import { headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, oneOf, text, type FormState, invalid } from "@/lib/form";
import { isUuid, playerName } from "@/lib/softball";
import { GOAL_PHASES, MOTTO_MAX, SPOTLIGHT } from "@/lib/culture";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { currentStandardsVersion } from "./standards-version";

export async function saveTeamDugout(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };

  const teamId = text(fd, "team_id");
  if (!isUuid(teamId)) return { error: "Choose a team." };

  // Each row: its id when it's a saved standard (kept by id), its title and detail; plus the
  // saved standards the coach removed. Only those are deleted (save_team_dugout keeps the rest).
  const details = fd.getAll("standard_detail");
  const ids = fd.getAll("standard_id").map((v) => String(v));
  const rows = fd
    .getAll("standard_title")
    .map((t, i) => ({ id: isUuid(ids[i]) ? ids[i] : undefined, title: String(t).trim(), detail: String(details[i] ?? "").trim() }))
    .filter((s) => s.title || s.id);
  const removed = fd.getAll("standard_removed").map(String).filter(isUuid);
  const standards = rows.filter((s) => s.title);
  if (standards.length > 25) return { error: "Keep it to 25 standards or fewer." };
  if (standards.some((s) => s.title.length > 140)) return { error: "Keep each standard to 140 characters; put the rest in its detail." };
  if (standards.some((s) => s.detail.length > 800)) return { error: "Keep each standard's detail to 800 characters." };

  const headline = text(fd, "headline");
  const statement = text(fd, "statement");
  if ((headline ?? "").length > 120) return invalid("headline", "Keep the headline to 120 characters.");
  if ((statement ?? "").length > 4000) return invalid("statement", "Keep the team culture description to 4,000 characters.");

  const supabase = await createClient();
  // The save replaces the whole list, so never save from an out-of-date page: if the standards
  // or culture changed since this form was loaded (another tab, the phone app), stop.
  const version = text(fd, "version");
  if (!version) return { error: STALE };
  if (version !== (await currentStandardsVersion(supabase, teamId)))
    return {
      error:
        "These standards changed since you opened this page (maybe on another device or tab), so nothing was saved. Reload the page to see the latest, then make your change again.",
    };
  const { error } = await supabase.rpc("save_team_dugout", {
    p_team_id: teamId,
    p_headline: headline,
    p_statement: statement,
    p_standards: [...rows, ...removed.map((id) => ({ id, remove: true }))],
  });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

// ---------------------------------------------------------------------------
// Culture & team (Phase 5): motto, Team Season Goals, Player Spotlights (head coach)
// ---------------------------------------------------------------------------

export async function saveMotto(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  const motto = text(fd, "motto");
  if (!isUuid(teamId)) return { error: "Unknown team." };
  if (motto && motto.length > MOTTO_MAX) return { error: `Keep the motto under ${MOTTO_MAX} characters.` };
  const supabase = await createClient();
  const { error } = await supabase.from("team_culture").upsert({ team_id: teamId, motto, updated_at: new Date().toISOString() }, { onConflict: "team_id" });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

function amount(fd: FormData, name: string): number | null | "invalid" {
  const raw = text(fd, name);
  if (raw === null) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && Math.abs(n) < 1_000_000 ? n : "invalid";
}

export async function saveGoal(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const id = text(fd, "id");
  const teamId = text(fd, "team_id");
  const phase = oneOf(fd, "phase", GOAL_PHASES) ?? "season";
  const title = text(fd, "title");
  const unit = text(fd, "unit");
  const target = amount(fd, "target");
  const current = amount(fd, "current");
  if (!isUuid(teamId) || (id && !isUuid(id))) return { error: "Unknown team." };
  if (!title || title.length > 140) return invalid("title", "Write the goal (140 characters at most).");
  if (target === "invalid" || current === "invalid") return { error: "Target and progress are numbers." };
  if (unit && unit.length > 20) return invalid("unit", "Keep the unit short (20 characters).");
  const supabase = await createClient();
  const row = { team_id: teamId, phase, title, target, current, unit, updated_at: new Date().toISOString() };
  const { error } = id ? await supabase.from("team_goals").update(row).eq("id", id) : await supabase.from("team_goals").insert({ ...row, position: Date.now() % 30000 });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function setGoalAchieved(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("team_goals").update({ achieved_at: fd.get("achieved") === "on" ? new Date().toISOString() : null }).eq("id", id));
    refresh();
  });
}

export async function deleteGoal(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("team_goals").delete().eq("id", id));
    refresh();
  });
}

export async function saveSpotlight(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  const playerId = text(fd, "player_id");
  const headline = text(fd, "headline");
  const body = text(fd, "body");
  if (!isUuid(teamId) || !isUuid(playerId)) return { error: "Pick a player." };
  if (!headline || headline.length > SPOTLIGHT.headline) return { error: `Write a headline (${SPOTLIGHT.headline} characters at most).` };
  if (!body || body.length > SPOTLIGHT.body) return { error: `Write the story (${SPOTLIGHT.body} characters at most).` };
  const supabase = await createClient();
  const { data } = await supabase
    .from("roster_entries")
    .select("jersey_number, player:players(first_name, preferred_name, last_name)")
    .eq("team_id", teamId)
    .eq("player_id", playerId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const entry = data as { jersey_number: string | null; player: { first_name: string; preferred_name: string | null; last_name: string } | null } | null;
  if (!entry?.player) return { error: "She isn't on this team's roster." };
  const { error } = await supabase.from("player_spotlights").insert({
    team_id: teamId,
    player_id: playerId,
    player_name: playerName(entry.player),
    jersey: entry.jersey_number,
    headline,
    body,
  });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function deleteSpotlight(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("player_spotlights").delete().eq("id", id));
    refresh();
  });
}
