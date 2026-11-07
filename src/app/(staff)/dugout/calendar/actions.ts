"use server";

import { refresh } from "next/cache";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, isoDate, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { readEventForm, weeklyDates } from "@/lib/team-events";

/** Adds an event (optionally weekly, as one series) or saves changes to one. Coaches and admins only. */
export async function saveCalendarEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const event = readEventForm(fd);
  if (event.error !== null) return { error: event.error };
  const supabase = await createClient();
  const id = text(fd, "id");

  if (id) {
    if (!isUuid(id)) return { error: "Unknown event." };
    const { data, error } = await supabase
      .from("team_events")
      .update({ ...event.values, event_date: event.event_date })
      .eq("id", id)
      .select("id");
    if (error) return { error: friendlyDbError(error) };
    if (!data?.length) return { error: "That event no longer exists, or you can't change it." };
  } else {
    const teamId = text(fd, "team_id");
    if (!isUuid(teamId)) return { error: "Choose a team." };
    const repeatUntil = isoDate(fd, "repeat_until");
    if (repeatUntil && repeatUntil < event.event_date) return { error: "“Repeat until” is before the first date." };
    const dates = weeklyDates(event.event_date, repeatUntil);
    const series_id = dates.length > 1 ? crypto.randomUUID() : null;
    const { error } = await supabase
      .from("team_events")
      .insert(dates.map((event_date) => ({ ...event.values, team_id: teamId, event_date, series_id })));
    if (error) return { error: friendlyDbError(error) };
  }

  refresh();
  return { error: null, saved: true };
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
