"use server";

// Measurements on her POP Report: coaches add a value (the date sets its season) and
// remove a mistake. Testing results land in the same table from the Dugout.
import { refresh } from "next/cache";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isoDate, text, invalid, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { todayISO } from "@/lib/dates";

export async function addMeasurement(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const playerId = text(fd, "player_id");
    const metricKey = text(fd, "metric_key");
    if (!isUuid(playerId) || !metricKey || !/^[a-z0-9_]+$/.test(metricKey)) return failed(STALE);
    const raw = (text(fd, "value") ?? "").replace(",", ".");
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value <= 0 || value >= 10000) return invalid("value", "Enter the measurement as a number, like 3.1 or 54.");
    const measuredOn = isoDate(fd, "measured_on") ?? todayISO();
    if (measuredOn > todayISO()) return invalid("measured_on", "That date hasn't happened yet.");
    const supabase = await createClient();
    must(await supabase.from("measurements").insert({ player_id: playerId, metric_key: metricKey, value, measured_on: measuredOn }));
    refresh();
  });
}

export async function deleteMeasurement(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const id = text(fd, "id");
    if (!isUuid(id)) return failed(STALE);
    const supabase = await createClient();
    must(await supabase.from("measurements").delete().eq("id", id));
    refresh();
  });
}
