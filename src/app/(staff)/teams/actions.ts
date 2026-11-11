"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { editorCheck } from "@/lib/auth";
import { readEventForm, readRepeat, timeOf } from "@/lib/team-events";
import { createClient } from "@/lib/supabase/server";
import { checkbox, friendlyDbError, isoDate, oneOf, text, wholeNumber, type FormState, invalid } from "@/lib/form";
import { BATS, FORMATS, POSITIONS, THROWS, isUuid } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";

const JERSEY = /^\d{1,2}$/;
const DUPLICATE_TEAM = "A team with that name and age group already exists.";

function teamFields(fd: FormData) {
  return {
    name: text(fd, "name"),
    short_name: text(fd, "short_name"),
    organization: text(fd, "organization"),
    age_group: text(fd, "age_group"),
    format: oneOf(fd, "format", FORMATS) ?? "fastpitch",
    is_own_team: fd.get("is_own_team") === "true",
    home_field: text(fd, "home_field"),
    notes: text(fd, "notes"),
    welcome_message: text(fd, "welcome_message"),
  };
}

export async function createTeam(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const fields = teamFields(fd);
  if (!fields.name) return { error: "Give the team a name." };
  const team = { ...fields, name: fields.name };
  if ((team.welcome_message ?? "").length > 1000) return { error: "Keep the welcome message to 1,000 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").insert(team).select("id").single();
  if (error) return { error: friendlyDbError(error, DUPLICATE_TEAM) };

  // Our teams go straight to building the roster.
  redirect(team.is_own_team ? `/teams/${data.id}/intake` : `/teams/${data.id}`);
}

export async function updateTeam(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const id = text(fd, "id");
  if (!isUuid(id)) return { error: "Unknown team." };
  const fields = teamFields(fd);
  if (!fields.name) return { error: "Give the team a name." };
  const team = { ...fields, name: fields.name };
  if ((team.welcome_message ?? "").length > 1000) return { error: "Keep the welcome message to 1,000 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").update(team).eq("id", id).select("id");
  if (error) return { error: friendlyDbError(error, DUPLICATE_TEAM) };
  if (!data?.length) return { error: "That team no longer exists, or you can't edit it." };

  refresh();
  return { error: null, saved: true };
}

export async function createSeason(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const name = text(fd, "name");
  const start_date = isoDate(fd, "start_date");
  const end_date = isoDate(fd, "end_date");
  const teamId = text(fd, "team_id");
  if (!name) return invalid("name", "Name the season, e.g. “Spring 2027”.");
  if (start_date && end_date && end_date < start_date) {
    return { error: "The end date is before the start date." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .insert({ name, start_date, end_date })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error, "A season with that name already exists.") };

  if (isUuid(teamId) && fd.get("next") === "intake") redirect(`/teams/${teamId}/intake?season=${data.id}`);
  redirect(isUuid(teamId) ? `/teams/${teamId}?season=${data.id}` : "/teams");
}

/** Creates a new player and puts them on the roster in one step. */
export async function addNewPlayerToRoster(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const teamId = text(fd, "team_id");
  const seasonId = text(fd, "season_id");
  if (!isUuid(teamId) || !isUuid(seasonId)) return { error: "Pick a team and season first." };

  const first_name = text(fd, "first_name");
  const last_name = text(fd, "last_name");
  if (!first_name || !last_name) return { error: "Enter the player's first and last name." };

  const jersey = text(fd, "jersey_number");
  if (jersey && !JERSEY.test(jersey)) return invalid("jersey_number", "Jersey numbers are 0–99 (00 is fine).");

  const grad_year = wholeNumber(fd, "grad_year", 2000, 2100);
  if (grad_year === "invalid") return invalid("grad_year", "Grad year should be a year like 2030.");

  const supabase = await createClient();
  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      first_name,
      last_name,
      bats: oneOf(fd, "bats", BATS),
      throws: oneOf(fd, "throws", THROWS),
      primary_position: oneOf(fd, "primary_position", POSITIONS),
      grad_year,
    })
    .select("id")
    .single();
  if (playerError) return { error: friendlyDbError(playerError) };

  const { error: rosterError } = await supabase
    .from("roster_entries")
    .insert({ team_id: teamId, season_id: seasonId, player_id: player.id, jersey_number: jersey });
  if (rosterError) {
    // Don't leave a player behind who was only meant for this roster.
    await supabase.from("players").delete().eq("id", player.id);
    return { error: friendlyDbError(rosterError) };
  }

  refresh();
  return { error: null, saved: true };
}

export async function addExistingPlayerToRoster(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const teamId = text(fd, "team_id");
  const seasonId = text(fd, "season_id");
  const playerId = text(fd, "player_id");
  if (!isUuid(teamId) || !isUuid(seasonId)) return { error: "Pick a team and season first." };
  if (!isUuid(playerId)) return { error: "Choose a player." };

  const jersey = text(fd, "jersey_number");
  if (jersey && !JERSEY.test(jersey)) return invalid("jersey_number", "Jersey numbers are 0–99 (00 is fine).");

  const supabase = await createClient();
  const { error } = await supabase
    .from("roster_entries")
    .insert({ team_id: teamId, season_id: seasonId, player_id: playerId, jersey_number: jersey });
  if (error) return { error: friendlyDbError(error, "That player is already on this roster.") };

  refresh();
  return { error: null, saved: true };
}

export async function updateRosterEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const id = text(fd, "id");
  if (!isUuid(id)) return { error: "Unknown roster entry." };
  const jersey = text(fd, "jersey_number");
  if (jersey && !JERSEY.test(jersey)) return invalid("jersey_number", "Jersey numbers are 0–99 (00 is fine).");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roster_entries")
    .update({ jersey_number: jersey, active: checkbox(fd, "active") })
    .eq("id", id)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "That roster spot no longer exists." };

  refresh();
  return { error: null, saved: true };
}

/** Takes a player off this team's roster for the season. The player and their history stay. */
export async function removeFromRoster(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("roster_entries").delete().eq("id", id));
    refresh();
  });
}

// ---------------------------------------------------------------------------
// Team schedule (shown in each player's TWIS)
// ---------------------------------------------------------------------------

const GAME_TYPES = ["league", "tournament_pool", "tournament_bracket", "showcase", "scrimmage", "exhibition"] as const;

/** Adds a practice or other team event, one time or repeating (one series; lib/recurrence.ts). */
export async function addTeamEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const teamId = text(fd, "team_id");
    if (!isUuid(teamId)) return failed(STALE);
    const event = readEventForm(fd);
    if (event.error !== null) return failed(event.error);
    const repeat = readRepeat(fd, event.event_date);
    if (repeat.error !== null) return invalid(repeat.field, repeat.error);

    const series_id = repeat.dates.length > 1 ? crypto.randomUUID() : null;
    const supabase = await createClient();
    must(await supabase.from("team_events").insert(repeat.dates.map((event_date) => ({ ...event.values, team_id: teamId, event_date, series_id }))));
    refresh();
  });
}

export async function deleteTeamEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("team_events").delete().eq("id", id));
    refresh();
  });
}

export async function addGame(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const teamId = text(fd, "team_id");
  const opponentId = text(fd, "opponent_id");
  if (!isUuid(teamId)) return { error: "Unknown team." };
  if (!isUuid(opponentId)) return { error: "Choose the opponent. Add them on the Teams page first if they're new." };
  if (opponentId === teamId) return { error: "A team can't play itself." };
  const game_date = isoDate(fd, "game_date");
  if (!game_date) return invalid("game_date", "Pick the game date.");
  const seasonId = text(fd, "season_id");
  const innings = wholeNumber(fd, "scheduled_innings", 1, 15);
  if (innings === "invalid") return invalid("scheduled_innings", "Innings should be between 1 and 15.");
  const home = fd.get("home_away") !== "away";

  const supabase = await createClient();
  const { error } = await supabase.from("games").insert({
    season_id: isUuid(seasonId) ? seasonId : null,
    game_date,
    start_time: timeOf(fd, "start_time"),
    home_team_id: home ? teamId : opponentId,
    away_team_id: home ? opponentId : teamId,
    venue: text(fd, "venue"),
    event_name: text(fd, "event_name"),
    game_type: oneOf(fd, "game_type", GAME_TYPES) ?? "league",
    scheduled_innings: innings ?? 7,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

// ---------------------------------------------------------------------------
// Team logo (shown on the team page)
// ---------------------------------------------------------------------------

const LOGO_PATH = /^[0-9a-f-]{36}\/\d+\.(png|jpg|jpeg|webp)$/i;

/** Saves (or clears) the team's logo after the browser has uploaded it to Storage. */
export async function setTeamLogo(input: { teamId: string; path: string | null }): Promise<{ error: string | null }> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.teamId)) return { error: "Unknown team." };
  if (input.path !== null && (!LOGO_PATH.test(input.path) || !input.path.startsWith(`${input.teamId}/`))) {
    return { error: "That upload doesn't belong to this team." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").update({ logo_path: input.path }).eq("id", input.teamId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "That team no longer exists, or you can't edit it." };

  refresh();
  return { error: null };
}

// ---------------------------------------------------------------------------
// Player claims (a player's account claiming her spot on the roster)
// ---------------------------------------------------------------------------

/** Approves a claim (matched to a spot on that season's roster) or declines it. */
export async function decidePlayerClaim(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "claim_id");
    const entry = text(fd, "roster_entry_id");
    if (!isUuid(id)) return failed(STALE);
    const approve = fd.get("decision") === "approve";
    if (approve && !isUuid(entry)) return failed(STALE);
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getClaims();
    must(await supabase
      .from("player_claims")
      .update({
        status: approve ? "approved" : "declined",
        ...(approve ? { roster_entry_id: entry } : {}),
        decided_by: auth?.claims?.sub ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id));
    refresh();
  });
}

export async function removePlayerClaim(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "claim_id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("player_claims").delete().eq("id", id));
    refresh();
  });
}
