"use server";

// TWIS check-offs and her own activities.
import { refresh } from "next/cache";
import { actForCheck, actorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, isISODate, todayISO, weekStart } from "@/lib/dates";
import { friendlyDbError, isoDate, text, type FormState, invalid } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import type { TwisKind } from "./data";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { awardAchievements } from "./player-achievements";

// ---------------------------------------------------------------------------
// TWIS check-offs
// ---------------------------------------------------------------------------

export async function setTwisCheck(input: {
  playerId: string;
  kind: TwisKind;
  refId: string;
  onDate: string;
  checked: boolean;
}): Promise<{ error: string | null }> {
  const denied = await actForCheck(input.playerId);
  if (denied) return { error: denied };
  const { playerId, kind, refId, onDate, checked } = input;
  if (!isUuid(playerId) || !isUuid(refId) || !isISODate(onDate) || !["game", "event", "activity"].includes(kind)) {
    return { error: "That item couldn't be updated. Reload the page and try again." };
  }

  const column = kind === "game" ? "game_id" : kind === "event" ? "team_event_id" : "activity_id";
  const supabase = await createClient();

  if (checked) {
    const ref = column === "game_id" ? { game_id: refId } : column === "team_event_id" ? { team_event_id: refId } : { activity_id: refId };
    const { error } = await supabase.from("twis_checks").insert({ player_id: playerId, ...ref, on_date: onDate });
    // Already ticked (another tab, a double click) is fine.
    if (error && error.code !== "23505") return { error: friendlyDbError(error) };
  } else {
    const { error } = await supabase
      .from("twis_checks")
      .delete()
      .eq("player_id", playerId)
      .eq(column, refId)
      .eq("on_date", onDate);
    if (error) return { error: friendlyDbError(error) };
  }

  if (kind === "activity" && checked) await awardAchievements(supabase, playerId);

  refresh();
  return { error: null };
}

// ---------------------------------------------------------------------------
// Activities the player commits to
// ---------------------------------------------------------------------------

export async function addActivity(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await actorCheck();
  if (denied) return { error: denied };

  const playerId = text(fd, "player_id");
  if (!isUuid(playerId)) return { error: "Unknown player." };
  const notHers = await actForCheck(playerId);
  if (notHers) return { error: notHers };
  const title = text(fd, "title");
  if (!title) return invalid("title", "Name the activity, e.g. “Tee work” or “Long toss”.");

  const days = fd
    .getAll("days")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  const starts_on = isoDate(fd, "starts_on") ?? weekStart(todayISO());
  const thisWeekOnly = fd.get("this_week_only") === "on";
  const ends_on = thisWeekOnly ? addDays(weekStart(starts_on), 6) : isoDate(fd, "ends_on");
  if (ends_on && ends_on < starts_on) return invalid("ends_on", "The end date is before the start date.");
  const pillarId = text(fd, "pillar_id");

  const supabase = await createClient();
  const { error } = await supabase.from("player_activities").insert({
    player_id: playerId,
    title,
    details: text(fd, "details"),
    days: [...new Set(days)].sort(),
    starts_on,
    ends_on,
    pillar_id: isUuid(pillarId) ? pillarId : null,
  });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

/** Stop an ongoing activity from today on. Past check-offs stay. */
export async function endActivity(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await actorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    const today = todayISO();
    const { data } = await supabase.from("player_activities").select("starts_on").eq("id", id).maybeSingle();
    if (!data) return failed(STALE);
    // Ends yesterday, so it's gone from today on; one that hasn't started yet ends on its start date.
    const yesterday = addDays(today, -1);
    const endsOn = yesterday < data.starts_on ? data.starts_on : yesterday;
    must(await supabase.from("player_activities").update({ ends_on: endsOn }).eq("id", id));
    refresh();
  });
}

/** Remove an activity entirely, with its check-offs (for ones added by mistake). */
export async function deleteActivity(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await actorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("player_activities").delete().eq("id", id));
    refresh();
  });
}

// ---------------------------------------------------------------------------
