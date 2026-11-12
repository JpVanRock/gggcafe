"use server";

// The Switchboard (user, 2026-11-12): head coaches and admins turn a feature off or on for one
// team, or a whole group at once. The database checks again (head-coach write policies).
import { refresh } from "next/cache";
import { headCoachCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { STALE, failed, must, runAction } from "@/lib/actions";
import { AUDIENCES, isSwitchKey, switchesFor, type Audience, type SwitchKey } from "@/lib/switchboard";

async function setSwitches(teamId: string, keys: SwitchKey[], on: boolean) {
  const supabase = await createClient();
  if (on) must(await supabase.from("team_features_off").delete().eq("team_id", teamId).in("feature", keys));
  else must(await supabase.from("team_features_off").upsert(keys.map((feature) => ({ team_id: teamId, feature })), { onConflict: "team_id,feature", ignoreDuplicates: true }));
}

/** One switch: `on` = "true" turns it on (the row goes), else off. */
export async function setFeature(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const teamId = text(fd, "team_id");
    const feature = fd.get("feature");
    if (!isUuid(teamId) || !isSwitchKey(feature)) return failed(STALE);
    await setSwitches(teamId, [feature], fd.get("on") === "true");
    refresh();
  });
}

/** A whole group (Players, Parents or Mentors) on or off. */
export async function setAudience(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await headCoachCheck();
    if (denied) return failed(denied);
    const teamId = text(fd, "team_id");
    const audience = AUDIENCES.find((a) => a.key === fd.get("audience"))?.key as Audience | undefined;
    if (!isUuid(teamId) || !audience) return failed(STALE);
    await setSwitches(teamId, switchesFor(audience).map((s) => s.key), fd.get("on") === "true");
    refresh();
  });
}
