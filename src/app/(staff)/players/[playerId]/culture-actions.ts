"use server";

// Her commitment and the team pledge (Phase 5): one "I will..." that covers every Team
// Standard (user, 2026-11-11) and her signature, for her team's current season. She or a
// coach saves it.
import { refresh } from "next/cache";
import { actForCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, text, type FormState, invalid } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { seasonOrCurrent } from "@/lib/roster";
import { cleanPledge } from "@/lib/culture";

export async function savePledge(_prev: FormState, fd: FormData): Promise<FormState> {
  const playerId = text(fd, "player_id");
  const teamId = text(fd, "team_id");
  if (!isUuid(playerId) || !isUuid(teamId)) return { error: "Unknown team." };
  const denied = await actForCheck(playerId);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const season = await seasonOrCurrent(supabase, teamId, null);
  if (!season) return { error: "The team has no roster this season yet." };
  const lines = cleanPledge(fd.get("pledge"));
  const sign = fd.get("sign") === "on";
  const signedName = text(fd, "signed_name");
  if (sign && (!signedName || signedName.length > 80)) return invalid("signed_name", "Type your name to sign.");
  const { data: existing } = await supabase
    .from("team_pledges")
    .select("signed_name, signed_at")
    .eq("player_id", playerId)
    .eq("team_id", teamId)
    .eq("season_id", season)
    .maybeSingle();
  const signature = sign
    ? { signed_name: signedName, signed_at: (existing as { signed_at: string | null } | null)?.signed_at ?? new Date().toISOString() }
    : { signed_name: (existing as { signed_name: string | null } | null)?.signed_name ?? null, signed_at: (existing as { signed_at: string | null } | null)?.signed_at ?? null };
  const { error } = await supabase
    .from("team_pledges")
    .upsert({ player_id: playerId, team_id: teamId, season_id: season, lines, ...signature, updated_at: new Date().toISOString() }, { onConflict: "player_id,team_id,season_id" });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}
