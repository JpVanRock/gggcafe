"use server";

// Coaches who are parents (user, 2026-11-12): claim a daughter from the roster. The
// database checks the caller is a coach and that she's on one of our current rosters
// (claim_my_daughter); a head coach's claim is approved at once, an assistant's waits.
import { refresh } from "next/cache";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text, type FormState } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { STALE, failed, runAction } from "@/lib/actions";

export async function claimDaughter(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const denied = await editorCheck();
    if (denied) return failed(denied);
    const playerId = text(fd, "player_id");
    if (!playerId) return { error: "Choose your daughter.", fields: { player_id: "Choose your daughter." } };
    if (!isUuid(playerId)) return failed(STALE);
    const supabase = await createClient();
    const { error } = await supabase.rpc("claim_my_daughter", { p_player_id: playerId });
    if (error?.code === "P0006") return failed("She isn't on one of our current rosters.");
    if (error) return failed("Couldn't claim her. Try again.");
    refresh();
  });
}
