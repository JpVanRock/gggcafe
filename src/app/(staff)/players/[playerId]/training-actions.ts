"use server";

// Performance Training: her routines (from the drill library or a new drill).
import { refresh } from "next/cache";
import { actForCheck, actorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import { friendlyDbError, isoDate, oneOf, text, type FormState, invalid } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { TRAINING_CATEGORIES, categoriesFor } from "@/lib/achievements";
import type { Enums } from "@/lib/supabase/database.types";

// ---------------------------------------------------------------------------
// Performance Training
// ---------------------------------------------------------------------------

function httpUrl(fd: FormData, name: string): string | null | "invalid" {
  const value = text(fd, name);
  if (value === null) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "invalid";
  } catch {
    return "invalid";
  }
}

/** Adds a training routine (from the drill library, or a new drill) on chosen days. */
export async function addRoutine(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await actorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const notHers = await actForCheck(playerId);
  if (notHers) return { error: notHers };
  const category = oneOf(fd, "category", TRAINING_CATEGORIES);
  if (!category) return invalid("category", "Unknown training category.");

  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("primary_position, secondary_positions")
    .eq("id", playerId)
    .maybeSingle();
  if (!player) return { error: "Unknown player." };
  const positions = [player.primary_position, ...(player.secondary_positions ?? [])].filter((p) => p !== null);
  if (!categoriesFor(positions).includes(category)) {
    return { error: category === "pitching" ? "Pitching drills are for pitchers." : "Catching drills are for catchers." };
  }

  let drillId = text(fd, "drill_id");
  let title: string | null = null;
  if (isUuid(drillId)) {
    const { data: drill } = await supabase.from("drills").select("name").eq("id", drillId).maybeSingle();
    if (!drill) return { error: "That drill is no longer in the library." };
    title = drill.name;
  } else {
    title = text(fd, "new_name");
    const description = text(fd, "new_description");
    if (!title) return { error: "Choose from the library, or name the new routine." };
    if (!description) return invalid("new_description", "Describe the new routine in a sentence so the player knows what to do.");
    const video_url = httpUrl(fd, "new_video_url");
    if (video_url === "invalid") return invalid("new_video_url", "The video link should start with https://");
    const AREA: Record<string, Enums<"skill_area">> = {
      workout: "strength_conditioning", stretching: "strength_conditioning", hitting: "hitting",
      fielding: "infield", pitching: "pitching", catching: "catching", mental: "mental",
    };
    const { data, error } = await supabase
      .from("drills")
      .insert({ name: title, area: AREA[category], category, description, equipment: text(fd, "new_equipment"), video_url })
      .select("id")
      .single();
    if (error) return { error: friendlyDbError(error, `There's already a drill called “${title}”. Pick it from the library instead.`) };
    drillId = data.id;
  }

  const days = fd.getAll("days").map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  const { error } = await supabase.from("player_activities").insert({
    player_id: playerId,
    title,
    details: text(fd, "prescription"),
    days: [...new Set(days)].sort(),
    starts_on: isoDate(fd, "starts_on") ?? todayISO(),
    category,
    drill_id: drillId,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

// ---------------------------------------------------------------------------
