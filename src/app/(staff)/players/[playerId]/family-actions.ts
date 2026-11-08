"use server";

// Her preseason questionnaire (Phase 6), saved by her or a coach for her current team and season.
import { refresh } from "next/cache";
import { actForCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { lineupSeason } from "@/lib/gameday-data";
import { cleanQuestionnaire } from "@/lib/family";

export async function saveQuestionnaire(_prev: FormState, fd: FormData): Promise<FormState> {
  const playerId = text(fd, "player_id");
  const teamId = text(fd, "team_id");
  if (!isUuid(playerId) || !isUuid(teamId)) return { error: "Unknown team." };
  const denied = await actForCheck(playerId);
  if (denied) return { error: denied };
  const q = cleanQuestionnaire({ ...Object.fromEntries(fd.entries()), numbers: fd.getAll("numbers"), positions: fd.getAll("positions") });
  if (typeof q === "string") return { error: q };
  const supabase = await createClient();
  const season = await lineupSeason(supabase, teamId, null);
  if (!season) return { error: "The team has no roster this season yet." };
  const { error } = await supabase
    .from("player_questionnaires")
    .upsert({ player_id: playerId, team_id: teamId, season_id: season, ...q, updated_at: new Date().toISOString() }, { onConflict: "player_id,team_id,season_id" });
  if (error) return { error: friendlyDbError(error) };
  refresh();
  return { error: null, saved: true };
}
