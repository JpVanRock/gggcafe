"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ResetRequestState = { sent: boolean; error: string | null; email: string };

/**
 * Emails a password-reset link. The link comes back to /auth/confirm on this
 * site, which signs her in and sends her to /reset-password. Supabase only
 * follows links to addresses on its Redirect URLs list (gggcafe.vercel.app/**);
 * anything else falls back to the Site URL.
 */
export async function requestPasswordReset(
  _previous: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { sent: false, error: "Enter the email you sign in with.", email };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "gggcafe.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${proto}://${host}/auth/confirm?next=/reset-password`,
  });

  if (error?.status === 429) {
    return { sent: false, error: "Too many reset requests. Wait a minute and try again.", email };
  }
  // Same answer whether or not the email has an account, so the form can't be
  // used to find out who has one.
  return { sent: true, error: null, email };
}
