"use server";

import { refresh } from "next/cache";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, text, type FormState, invalid } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { readEventForm, readRepeat } from "@/lib/team-events";

/**
 * Adds an event, one time or repeating (each date its own row, sharing a series_id; lib/recurrence.ts),
 * or saves changes to one. A change can cover this event and the later ones in its series ("following"):
 * those keep their own dates and take the new type, title, times, place and notes. Coaches and admins only.
 */
export async function saveCalendarEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const event = readEventForm(fd);
    if (event.error !== null) return failed(event.error);
    const supabase = await createClient();
    const id = text(fd, "id");

    if (id) {
      if (!isUuid(id)) return failed(STALE);
      const { data: saved } = await supabase.from("team_events").select("series_id, event_date, team_id").eq("id", id).maybeSingle();
      if (!saved) return failed("That event no longer exists, or you can't change it.");
      const { data } = must(await supabase.from("team_events").update({ ...event.values, event_date: event.event_date }).eq("id", id).select("id"));
      if (!data?.length) return failed("That event no longer exists, or you can't change it.");
      if (fd.get("scope") === "following" && saved.series_id) {
        must(
          await supabase
            .from("team_events")
            .update(event.values)
            .eq("series_id", saved.series_id)
            .eq("team_id", saved.team_id)
            .gt("event_date", saved.event_date),
        );
      }
    } else {
      const teamId = text(fd, "team_id");
      if (!isUuid(teamId)) return failed(STALE);
      const repeat = readRepeat(fd, event.event_date);
      if (repeat.error !== null) return invalid(repeat.field, repeat.error);
      const series_id = repeat.dates.length > 1 ? crypto.randomUUID() : null;
      must(await supabase.from("team_events").insert(repeat.dates.map((event_date) => ({ ...event.values, team_id: teamId, event_date, series_id }))));
    }
    refresh();
  });
}

/** Removes one event, or it and every later one in its weekly series. */
export async function deleteCalendarEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  const id = text(fd, "id");
  if (!isUuid(id)) return { error: "Unknown event." };

  const supabase = await createClient();
  const { data: event } = await supabase.from("team_events").select("series_id, event_date, team_id").eq("id", id).maybeSingle();
  if (!event) return { error: "That event no longer exists." };

  const query =
    fd.get("scope") === "following" && event.series_id
      ? supabase.from("team_events").delete().eq("series_id", event.series_id).eq("team_id", event.team_id).gte("event_date", event.event_date)
      : supabase.from("team_events").delete().eq("id", id);
  const { error } = await query;
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { error: null, saved: true };
}

/** Coaches set the offseason window (no end date = still going; no start = turn it off). */
export async function setOffseason(input: { teamId: string; startsOn: string; endsOn: string }): Promise<{ error: string | null }> {
  const denied = await editorCheck();
  if (denied) return { error: denied };
  if (!isUuid(input.teamId)) return { error: "Unknown team." };
  const iso = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const startsOn = iso(input.startsOn);
  const endsOn = iso(input.endsOn);
  const supabase = await createClient();
  if (!startsOn) {
    if (input.startsOn) return { error: "Pick a start date." };
    const { error } = await supabase.from("team_offseason").delete().eq("team_id", input.teamId);
    if (error) return { error: friendlyDbError(error) };
    refresh();
    return { error: null };
  }
  if (endsOn && endsOn < startsOn) return { error: "The offseason has to end after it starts." };
  const { error } = await supabase
    .from("team_offseason")
    .upsert({ team_id: input.teamId, starts_on: startsOn, ends_on: endsOn || null, updated_at: new Date().toISOString() }, { onConflict: "team_id" });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null };
}
