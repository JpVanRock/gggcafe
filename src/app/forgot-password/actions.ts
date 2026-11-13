"use server";

import { createClient } from "@/lib/supabase/server";
import { isPlayerLoginEmail } from "@/lib/player-logins";
import { requestOrigin } from "@/lib/request-origin";

export type ResetRequestState = { sent: boolean; error: string | null; email: string };

/**
 * Emails a password-reset link. The link comes back to /auth/confirm on this
 * site, which signs her in and sends her to /reset-password. Supabase only
 * follows links to addresses on its Redirect URLs list (www.ggg.cafe/**);
 * anything else falls back to the Site URL.
 */
export async function requestPasswordReset(
  _previous: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  // Username logins (made by a parent) have no inbox: the parent resets them on the family page.
  if (email && (!email.includes("@") || isPlayerLoginEmail(email))) {
    return { sent: false, error: "Signing in with a username? Ask your parent to set a new password on their family page, or ask your head coach.", email };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { sent: false, error: "Enter the email you sign in with.", email };
  }

  const supabase = await createClient();
  // At most 4 reset emails per address every 20 minutes (the database counts; it fails open
  // if it can't, and Supabase's own limits still apply).
  const { data: allowed, error: limitError } = await supabase.rpc("allow_password_reset", { p_email: email });
  if (limitError) console.error("Password reset limit check failed:", limitError);
  if (allowed === false) {
    return { sent: false, error: "That's 4 reset emails in 20 minutes. Check your inbox and spam folder, or try again in 20 minutes.", email };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await requestOrigin()}/auth/confirm?next=/reset-password`,
  });

  if (error?.status === 429) {
    // Supabase: one email per address per minute ("…only request this after 42 seconds")
    const seconds = /after (\d+) seconds?/i.exec(error.message)?.[1];
    if (seconds) return { sent: false, error: `Wait ${seconds} seconds, then try again.`, email };
    // Supabase's built-in email sends only a few emails an hour for the whole site
    // (resets and sign-up confirmations together)
    return { sent: false, error: "The site has sent too many emails in the last hour. Try again later; it can take up to an hour.", email };
  }
  // Same answer whether or not the email has an account, so the form can't be
  // used to find out who has one.
  return { sent: true, error: null, email };
}
