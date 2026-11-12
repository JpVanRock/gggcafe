"use server";

// Team measurements (user, 2026-11-12): one measurement for the whole roster at once, from
// the Dugout. Coaches and the team's team admin (a parent the head coach named) enter them;
// they show on each player's Pop Report. The database keeps a team admin to their own
// team's current roster.
import { refresh } from "next/cache";
import { dugoutCheck, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isoDate, text, invalid, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import { loadRoster } from "@/lib/roster";

export async function recordMeasurements(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const teamId = text(fd, "team_id");
    const denied = await dugoutCheck("measurements", teamId);
    if (denied) return failed(denied);
    const metricKey = text(fd, "metric_key");
    if (!isUuid(teamId) || !metricKey || !/^[a-z0-9_]+$/.test(metricKey)) return failed(STALE);
    const measuredOn = isoDate(fd, "measured_on") ?? todayISO();
    if (measuredOn > todayISO()) return invalid("measured_on", "That date hasn't happened yet.");

    const supabase = await createClient();
    const teamAdmin = !(await getCurrentUser())?.staff;
    const roster = new Set((await loadRoster(supabase, teamId, { teamAdmin })).map((p) => p.id));
    const rows: { player_id: string; metric_key: string; value: number; measured_on: string }[] = [];
    for (const [name, raw] of fd.entries()) {
      if (!name.startsWith("value_")) continue;
      const playerId = name.slice("value_".length);
      const typed = String(raw).trim().replace(",", ".");
      if (!typed) continue;
      if (!roster.has(playerId)) return failed(STALE);
      const value = Number(typed);
      if (!Number.isFinite(value) || value <= 0 || value >= 10000) return invalid(name, "Enter each measurement as a number, like 3.1 or 54.");
      rows.push({ player_id: playerId, metric_key: metricKey, value, measured_on: measuredOn });
    }
    if (rows.length === 0) return failed("Enter at least one player's number.");
    must(await supabase.from("measurements").insert(rows));
    refresh();
    return { error: null, saved: true };
  });
}

/** Removes one value (a typo). The database checks it's one this user may change. */
export async function removeMeasurement(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await dugoutCheck("measurements");
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    const { data } = must(await supabase.from("measurements").delete().eq("id", id).select("id"));
    if (!data?.length) return failed("That value is already gone, or you can't change it.");
    refresh();
  });
}
