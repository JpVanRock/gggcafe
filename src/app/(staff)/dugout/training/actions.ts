"use server";

// Coaches Dugout → Training (Phase 2): the roadmap, team routines, testing and the
// offseason draft. Coaches and assistants plan and test; the draft is head coach
// only. The database checks every write again (RLS, sync_team_routine).
import { refresh } from "next/cache";
import { editorCheck, headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, isoDate, oneOf, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { TRAINING_CATEGORIES } from "@/lib/achievements";
import { todayISO } from "@/lib/dates";
import { PHASE_KINDS, SQUAD_MAX, SQUAD_MIN, TESTS, onTheClock, suggestRoadmap, testByKey, tierFor, validCutoffs } from "@/lib/training-plan";

/** A form result that can also say what happened ("Pushed to 12 players."). */
export type TrainingState = FormState & { message?: string };

// ---------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------

export async function savePhase(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const id = text(fd, "id");
  const teamId = text(fd, "team_id");
  const kind = oneOf(fd, "kind", PHASE_KINDS);
  const name = text(fd, "name");
  const startsOn = isoDate(fd, "starts_on");
  const endsOn = isoDate(fd, "ends_on");
  const focus = text(fd, "focus");
  if (!isUuid(teamId) || (id && !isUuid(id))) return { error: "Unknown team." };
  if (!kind) return { error: "Pick the kind of phase." };
  if (!name || name.length > 60) return { error: "Name the phase (60 characters at most)." };
  if (!startsOn || !endsOn || endsOn < startsOn) return { error: "Check the dates: the end can't be before the start." };
  if (focus && focus.length > 300) return { error: "Keep the focus under 300 characters." };
  const supabase = await createClient();
  const row = { team_id: teamId, kind, name, starts_on: startsOn, ends_on: endsOn, focus };
  const { error } = id ? await supabase.from("training_phases").update(row).eq("id", id) : await supabase.from("training_phases").insert(row);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

export async function deletePhase(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("training_phases").delete().eq("id", id);
  refresh();
}

/** Builds a roadmap backward from the first game and the championship (replacing the current one if asked). */
export async function suggestPhases(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  const start = isoDate(fd, "start");
  const firstGame = isoDate(fd, "first_game");
  const championship = isoDate(fd, "championship");
  if (!isUuid(teamId)) return { error: "Unknown team." };
  if (!start || !firstGame || !championship) return { error: "Fill in all three dates." };
  const plan = suggestRoadmap({ start, firstGame, championship });
  if (plan.length === 0) return { error: "The start has to be before the first game, and the first game on or before the championship." };
  const supabase = await createClient();
  const { count } = await supabase.from("training_phases").select("id", { count: "exact", head: true }).eq("team_id", teamId);
  if ((count ?? 0) > 0) {
    if (fd.get("replace") !== "on") return { error: "This team already has a roadmap. Tick \"Replace it\" to start over." };
    const { error } = await supabase.from("training_phases").delete().eq("team_id", teamId);
    if (error) return { error: friendlyDbError(error) };
  }
  const { error } = await supabase.from("training_phases").insert(plan.map((p) => ({ team_id: teamId, kind: p.kind, name: p.name, starts_on: p.starts_on, ends_on: p.ends_on, focus: p.focus })));
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}

// ---------------------------------------------------------------------------
// Team routines
// ---------------------------------------------------------------------------

export async function saveTeamRoutine(_prev: TrainingState, fd: FormData): Promise<TrainingState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  const phaseId = text(fd, "phase_id");
  const category = oneOf(fd, "category", TRAINING_CATEGORIES);
  const drillId = text(fd, "drill_id");
  const details = text(fd, "details");
  const startsOn = isoDate(fd, "starts_on");
  const endsOn = isoDate(fd, "ends_on");
  const days = [...new Set(fd.getAll("days").map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
  if (!isUuid(teamId) || (phaseId && !isUuid(phaseId))) return { error: "Unknown team." };
  if (!category) return { error: "Pick a category." };
  if (!startsOn) return { error: "Pick the start date." };
  if (endsOn && endsOn < startsOn) return { error: "The end can't be before the start." };
  if (details && details.length > 500) return { error: "Keep \"how much\" under 500 characters." };
  const supabase = await createClient();
  let title = text(fd, "title");
  if (drillId) {
    if (!isUuid(drillId)) return { error: "Unknown drill." };
    const { data } = await supabase.from("drills").select("name").eq("id", drillId).maybeSingle();
    if (!data) return { error: "Unknown drill." };
    title = data.name as string;
  }
  if (!title || title.length > 120) return { error: "Pick a drill from the library or name the routine." };
  const { data, error } = await supabase
    .from("team_routines")
    .insert({ team_id: teamId, phase_id: phaseId, title, details, category, drill_id: drillId || null, days, starts_on: startsOn, ends_on: endsOn })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };
  const { data: added, error: syncError } = await supabase.rpc("sync_team_routine", { p_routine_id: data.id });
  if (syncError) return { error: friendlyDbError(syncError) };
  refresh();
  return { error: null, saved: true, message: `Pushed to ${added ?? 0} player${added === 1 ? "" : "s"}.` };
}

/** Ends a team routine today (or on its first day, if it hasn't started); every copy ends too. */
export async function endTeamRoutine(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("team_routines").select("starts_on").eq("id", id).maybeSingle();
  if (!data) return;
  const today = todayISO();
  await supabase.from("team_routines").update({ ends_on: (data.starts_on as string) > today ? data.starts_on : today }).eq("id", id);
  await supabase.rpc("sync_team_routine", { p_routine_id: id });
  refresh();
}

/** Removes the template; players' copies end today and keep their check-offs. */
export async function deleteTeamRoutine(fd: FormData) {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  await endTeamRoutine(fd);
  const supabase = await createClient();
  await supabase.from("team_routines").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Testing
// ---------------------------------------------------------------------------

/** Results from a testing session: inputs named "v:<player id>:<test key>". */
export async function saveResults(_prev: TrainingState, fd: FormData): Promise<TrainingState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const measuredOn = isoDate(fd, "measured_on");
  if (!measuredOn) return { error: "Pick the test date." };
  const rows: { player_id: string; metric_key: string; value: number; measured_on: string; context: string }[] = [];
  for (const [name, raw] of fd.entries()) {
    if (!name.startsWith("v:") || typeof raw !== "string" || raw.trim() === "") continue;
    const [, playerId, key] = name.split(":");
    const test = testByKey(key);
    const value = Number(raw.replace(",", "."));
    if (!isUuid(playerId) || !test) continue;
    if (!Number.isFinite(value) || value <= 0 || value > 10000) return { error: `Check the ${test.name} results: numbers only.` };
    rows.push({ player_id: playerId, metric_key: key, value, measured_on: measuredOn, context: "Testing" });
  }
  if (rows.length === 0) return { error: "Enter at least one result." };
  const supabase = await createClient();
  const { error } = await supabase.from("measurements").insert(rows);
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true, message: `${rows.length} result${rows.length === 1 ? "" : "s"} saved.` };
}

/** The rating bands for one age group: inputs "c:<test key>:0..3"; "reset:<key>" goes back to the starter band. */
export async function saveBands(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const ageGroup = text(fd, "age_group");
  if (!ageGroup || !/^\d{1,2}U$/.test(ageGroup)) return { error: "This team needs an age group first (team page)." };
  const supabase = await createClient();
  for (const test of TESTS) {
    if (fd.get(`reset:${test.key}`) === "on") {
      const { error } = await supabase.from("test_bands").delete().eq("metric_key", test.key).eq("age_group", ageGroup);
      if (error) return { error: friendlyDbError(error) };
      continue;
    }
    const cutoffs = [0, 1, 2, 3].map((i) => Number(String(fd.get(`c:${test.key}:${i}`) ?? "").replace(",", ".")));
    if (cutoffs.every((c, i) => c === test.bands[tierFor(ageGroup)][i])) continue;
    if (!validCutoffs(test.better, cutoffs)) {
      return { error: `${test.name}: four numbers, each ${test.better === "higher" ? "higher" : "lower"} than the one before.` };
    }
    const { error } = await supabase
      .from("test_bands")
      .upsert({ metric_key: test.key, age_group: ageGroup, cutoffs, updated_at: new Date().toISOString() }, { onConflict: "metric_key,age_group" });
    if (error) return { error: friendlyDbError(error) };
  }
  refresh();
  return { error: null, saved: true };
}

// ---------------------------------------------------------------------------
// The offseason draft (head coach)
// ---------------------------------------------------------------------------

/** Squads with a name and a captain each; captains are their squads' first members. */
export async function createSquads(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await headCoachCheck();
  if (denied) return { error: denied };
  const teamId = text(fd, "team_id");
  if (!isUuid(teamId)) return { error: "Unknown team." };
  const squads: { name: string; captain: string }[] = [];
  for (let i = 0; i < SQUAD_MAX; i++) {
    const name = text(fd, `name:${i}`);
    const captain = text(fd, `captain:${i}`);
    if (!name && !captain) continue;
    if (!name || name.length > 40) return { error: "Give every squad a name (40 characters at most)." };
    if (!isUuid(captain)) return { error: `Pick a captain for ${name}.` };
    squads.push({ name, captain });
  }
  if (squads.length < SQUAD_MIN) return { error: `Set up at least ${SQUAD_MIN} squads.` };
  if (new Set(squads.map((s) => s.captain)).size !== squads.length) return { error: "Each squad needs a different captain." };
  const supabase = await createClient();
  const { count } = await supabase.from("offseason_squads").select("id", { count: "exact", head: true }).eq("team_id", teamId);
  if ((count ?? 0) > 0) return { error: "Squads are already set up. Start over to change them." };
  const { data, error } = await supabase
    .from("offseason_squads")
    .insert(squads.map((s, i) => ({ team_id: teamId, name: s.name, captain_id: s.captain, pick_order: i + 1 })))
    .select("id, captain_id");
  if (error) return { error: friendlyDbError(error) };
  const { error: memberError } = await supabase
    .from("offseason_squad_members")
    .insert((data ?? []).map((s) => ({ team_id: teamId, player_id: s.captain_id, squad_id: s.id, pick_no: 0 })));
  if (memberError) return { error: friendlyDbError(memberError) };
  refresh();
  return { error: null, saved: true };
}

/** The squad on the clock picks this player (snake order). */
export async function draftPick(fd: FormData) {
  if (await headCoachCheck()) return;
  const teamId = text(fd, "team_id");
  const playerId = text(fd, "player_id");
  if (!isUuid(teamId) || !isUuid(playerId)) return;
  const supabase = await createClient();
  const [{ data: squads }, { data: members }] = await Promise.all([
    supabase.from("offseason_squads").select("id, pick_order").eq("team_id", teamId).order("pick_order"),
    supabase.from("offseason_squad_members").select("pick_no").eq("team_id", teamId).gt("pick_no", 0),
  ]);
  const list = (squads ?? []) as { id: string }[];
  if (list.length === 0) return;
  const picks = (members ?? []).length;
  const squad = list[onTheClock(list.length, picks)];
  await supabase.from("offseason_squad_members").insert({ team_id: teamId, player_id: playerId, squad_id: squad.id, pick_no: picks + 1 });
  refresh();
}

export async function undoPick(fd: FormData) {
  if (await headCoachCheck()) return;
  const teamId = text(fd, "team_id");
  if (!isUuid(teamId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("offseason_squad_members")
    .select("player_id, pick_no")
    .eq("team_id", teamId)
    .gt("pick_no", 0)
    .order("pick_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) await supabase.from("offseason_squad_members").delete().eq("team_id", teamId).eq("player_id", data.player_id);
  refresh();
}

export async function resetDraft(fd: FormData) {
  if (await headCoachCheck()) return;
  const teamId = text(fd, "team_id");
  if (!isUuid(teamId)) return;
  const supabase = await createClient();
  await supabase.from("offseason_squads").delete().eq("team_id", teamId);
  refresh();
}
