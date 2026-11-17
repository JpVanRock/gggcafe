"use server";

// Coaches who are parents (user, 2026-11-12): claim a daughter from the roster. The
// database checks the caller is a coach and that she's on one of our current rosters
// (claim_my_daughter); a head coach's claim is approved at once, an assistant's waits.
import { refresh } from "next/cache";
import { editorCheck, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { invalid, text, type FormState } from "@/lib/form";
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

/**
 * An assistant coach joins with the team's parent code after signing in (user, 2026-11-16: one code,
 * entered when first signed in), then waits for the head coach (request_staff_access).
 */
export async function requestAssistantAccess(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) return failed("Your session has ended. Sign in again.");
    const code = text(fd, "code");
    if (!code) return invalid("code", "Enter the parent code from your head coach.");
    const supabase = await createClient();
    const { data: teams, error } = await supabase.rpc("signup_parent_team", { p_code: code });
    if (error) return failed("Couldn't check the code. Try again.");
    const team = teams?.[0];
    if (!team) return invalid("code", "That code doesn't match a team. Check it with your head coach.");
    const { data: claims } = await supabase.auth.getClaims();
    const name = String((claims?.claims?.user_metadata as { display_name?: string } | undefined)?.display_name ?? user.email ?? "").slice(0, 80);
    const { error: requestError } = await supabase.rpc("request_staff_access", { p_role: "assistant", p_name: name, p_team_id: team.id });
    if (requestError) return failed("Couldn't send your request. Try again.");
    refresh();
  });
}
