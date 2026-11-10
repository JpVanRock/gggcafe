"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { failed, must, runAction } from "@/lib/actions";
import { invalid, type FormState } from "@/lib/form";
import { TERMS_VERSION, safeNext } from "@/lib/legal";

/**
 * Records that the signed-in user agreed to the current Terms (public.terms_acceptances: the
 * database stamps who and when), marks it on the account so src/proxy.ts stops asking, and goes on
 * to the page they were opening.
 */
export async function acceptTerms(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(async () => {
    if (fd.get("agree") !== "on") return invalid("agree", "Check the box to agree, or sign out.");
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) return failed("Your session ended. Sign in again.");
    must(await supabase.from("terms_acceptances").upsert({ version: TERMS_VERSION }, { onConflict: "user_id,version", ignoreDuplicates: true }));
    const { error } = await supabase.auth.updateUser({ data: { terms_version: TERMS_VERSION } });
    if (error) {
      console.error("Saving the Terms agreement on the account failed:", error);
      return failed("Couldn't save that. Try again in a moment.");
    }
    // A new sign-in token carries the agreement, so the next page doesn't ask again.
    await supabase.auth.refreshSession();
    redirect(safeNext(fd.get("next")));
  });
}
