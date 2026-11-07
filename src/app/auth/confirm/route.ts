import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where emailed links land: password resets and sign-up confirmations. Signs
 * her in from the link, then sends her on to `next`. Handles both link styles:
 *  - ?code=…            Supabase's default email template (PKCE; works in the
 *                       same browser that asked for the link)
 *  - ?token_hash=&type= a custom template linking here directly
 * When it can't sign her in: a reset goes back to "forgot password"; a sign-up
 * goes to sign-in. A sign-up link opened on another device has already
 * confirmed the email (Supabase checks it before sending her here), so she
 * just signs in.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safePath(params.get("next"));
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  // redirect() throws, so it stays outside any try/catch
  if (ok) redirect(next);
  if (next.startsWith("/reset-password")) redirect("/forgot-password?expired=1");
  // Supabase sends an error instead of a code when the link expired or was already used
  redirect(code ? "/login?confirm=done" : "/login?confirm=expired");
}

/** Only same-site paths, so the link can't bounce anyone to another website. */
function safePath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/dashboard";
}
