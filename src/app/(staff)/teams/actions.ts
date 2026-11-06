"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  checkbox, friendlyDbError, isoDate, oneOf, text, wholeNumber, type FormState,
} from "@/lib/form";
import { BATS, FORMATS, POSITIONS, THROWS, isUuid } from "@/lib/softball";

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
  };
}

export async function createTeam(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const team = teamFields(fd);
  if (!team.name) return { error: "Give the team a name." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").insert(team).select("id").single();
  if (error) return { error: friendlyDbError(error, DUPLICATE_TEAM) };

  redirect(`/teams/${data.id}`);
}

export async function updateTeam(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const id = text(fd, "id");
  if (!isUuid(id)) return { error: "Unknown team." };
  const team = teamFields(fd);
  if (!team.name) return { error: "Give the team a name." };

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
  if (!name) return { error: "Name the season, e.g. “Spring 2027”." };
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
  if (jersey && !JERSEY.test(jersey)) return { error: "Jersey numbers are 0–99 (00 is fine)." };

  const grad_year = wholeNumber(fd, "grad_year", 2000, 2100);
  if (grad_year === "invalid") return { error: "Grad year should be a year like 2030." };

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
  if (jersey && !JERSEY.test(jersey)) return { error: "Jersey numbers are 0–99 (00 is fine)." };

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
  if (jersey && !JERSEY.test(jersey)) return { error: "Jersey numbers are 0–99 (00 is fine)." };

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
export async function removeFromRoster(fd: FormData): Promise<void> {
  if (await editorCheck()) return;
  const id = text(fd, "id");
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("roster_entries").delete().eq("id", id);
  refresh();
}
