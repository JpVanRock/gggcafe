"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allOf, checkbox, friendlyDbError, isoDate, oneOf, text, wholeNumber, type FormState } from "@/lib/form";
import { BATS, MAX_WALK_UP_SONGS, POSITIONS, THROWS, isUuid, type WalkUpSong } from "@/lib/softball";
import { PHOTO_BUCKET } from "@/lib/player-photos";

const JERSEY = /^\d{1,2}$/;
const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9]+\.(jpg|png|webp)$/;

/** Walk-up songs from the form's parallel song_title / song_artist / song_link inputs. */
function walkUpSongs(fd: FormData): WalkUpSong[] | string {
  const titles = fd.getAll("song_title").map((v) => String(v).trim());
  const artists = fd.getAll("song_artist").map((v) => String(v).trim());
  const links = fd.getAll("song_link").map((v) => String(v).trim());
  const songs: WalkUpSong[] = [];
  for (let i = 0; i < titles.length; i++) {
    const [title, artist, link] = [titles[i], artists[i] ?? "", links[i] ?? ""];
    if (!title && !artist && !link) continue;
    if (!title) return "Give each walk-up song a title.";
    if (link && !/^https:\/\/\S+$/.test(link)) return "Song links should be full web addresses starting with https://";
    songs.push({ title: title.slice(0, 120), artist: artist.slice(0, 120) || null, link: link.slice(0, 500) || null });
  }
  if (songs.length > MAX_WALK_UP_SONGS) return `Up to ${MAX_WALK_UP_SONGS} walk-up songs.`;
  return songs;
}

function playerFields(fd: FormData) {
  const primary_position = oneOf(fd, "primary_position", POSITIONS);
  const photo = text(fd, "photo_path");
  return {
    grad_year: wholeNumber(fd, "grad_year", 2000, 2100),
    songs: walkUpSongs(fd),
    photoOk: !photo || PHOTO_PATH.test(photo),
    values: {
      first_name: text(fd, "first_name"),
      last_name: text(fd, "last_name"),
      preferred_name: text(fd, "preferred_name"),
      birth_date: isoDate(fd, "birth_date"),
      bats: oneOf(fd, "bats", BATS),
      throws: oneOf(fd, "throws", THROWS),
      primary_position,
      // the primary position doesn't need repeating as a secondary one
      secondary_positions: allOf(fd, "secondary_positions", POSITIONS).filter((p) => p !== primary_position),
      photo_path: photo,
    },
  };
}

type Fields = ReturnType<typeof playerFields>;

function validate(fields: Fields): string | null {
  if (!fields.values.first_name || !fields.values.last_name) return "Enter the player's first and last name.";
  if (fields.grad_year === "invalid") return "Class year should be a year like 2030.";
  const dob = fields.values.birth_date;
  if (dob && (dob < "1990-01-01" || dob > new Date().toISOString().slice(0, 10))) return "Check the date of birth.";
  if (!fields.photoOk) return "That photo didn't upload correctly. Pick it again.";
  if (typeof fields.songs === "string") return fields.songs;
  return null;
}

/** The intake form insists on these. */
function intakeMissing(fields: Fields): string | null {
  const v = fields.values;
  if (!v.birth_date) return "Enter her date of birth.";
  if (fields.grad_year === null) return "Enter her class year.";
  if (!v.bats) return "Pick her batting hand.";
  if (!v.throws) return "Pick her throwing hand.";
  if (!v.primary_position) return "Pick her primary position.";
  return null;
}

/** Intake: creates the player and puts her on her current team's roster (latest season). */
export async function createPlayer(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const fields = playerFields(fd);
  const invalid = validate(fields) ?? intakeMissing(fields);
  if (invalid) return { error: invalid };

  const teamId = text(fd, "team_id");
  if (!isUuid(teamId)) return { error: "Choose her current team." };
  const jersey = text(fd, "jersey_number");
  if (!jersey) return { error: "Enter her jersey number." };
  if (!JERSEY.test(jersey)) return { error: "Jersey numbers are 0–99 (00 is fine)." };

  const supabase = await createClient();
  let seasonId = text(fd, "season_id");
  if (!isUuid(seasonId)) {
    const { data: season } = await supabase
      .from("seasons")
      .select("id")
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!season) return { error: "Add a season on the team's page first (e.g. “Spring 2027”), then add players." };
    seasonId = season.id as string;
  }

  const { data: player, error } = await supabase
    .from("players")
    .insert({ ...fields.values, grad_year: fields.grad_year, walk_up_songs: fields.songs })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };

  const { error: rosterError } = await supabase
    .from("roster_entries")
    .insert({ team_id: teamId, season_id: seasonId, player_id: player.id, jersey_number: jersey });
  if (rosterError) {
    // Don't leave a player behind without her team.
    await supabase.from("players").delete().eq("id", player.id);
    return { error: friendlyDbError(rosterError, "She's already on that team's roster this season.") };
  }

  if (fd.get("stay")) {
    refresh();
    return { error: null, saved: true };
  }
  redirect(`/players/${player.id}`);
}

export async function updatePlayer(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const id = text(fd, "id");
  if (!isUuid(id)) return { error: "Unknown player." };
  const fields = playerFields(fd);
  const invalid = validate(fields);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data: before } = await supabase.from("players").select("photo_path").eq("id", id).maybeSingle();
  const { data, error } = await supabase
    .from("players")
    .update({
      ...fields.values,
      grad_year: fields.grad_year,
      walk_up_songs: fields.songs,
      is_slapper: checkbox(fd, "is_slapper"),
      notes: text(fd, "notes"),
    })
    .eq("id", id)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "That player no longer exists, or you can't edit them." };

  // A replaced or removed photo is deleted from Storage.
  const old = (before?.photo_path as string | null) ?? null;
  if (old && old !== fields.values.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([old]);

  refresh();
  return { error: null, saved: true };
}

/**
 * Moves a player to another team (any organization): her current roster spots
 * become inactive, kept as history, and she gets a spot on the new team for the
 * chosen season. Her profile, stats, goals and awards stay with her. She claims
 * the new spot from her account like any new season.
 */
export async function movePlayer(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const playerId = text(fd, "player_id");
  const teamId = text(fd, "team_id");
  const seasonId = text(fd, "season_id");
  const jersey = text(fd, "jersey_number");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  if (!isUuid(teamId)) return { error: "Choose her new team." };
  if (!isUuid(seasonId)) return { error: "Choose the season." };
  if (jersey && !JERSEY.test(jersey)) return { error: "Jersey numbers are 0–99 (00 is fine)." };

  const supabase = await createClient();
  const { error: moveError } = await supabase
    .from("roster_entries")
    .update({ active: false })
    .eq("player_id", playerId)
    .eq("active", true)
    .not("team_id", "eq", teamId);
  if (moveError) return { error: friendlyDbError(moveError) };
  const { error } = await supabase
    .from("roster_entries")
    .upsert(
      { team_id: teamId, season_id: seasonId, player_id: playerId, jersey_number: jersey, active: true },
      { onConflict: "team_id,season_id,player_id" },
    );
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}
