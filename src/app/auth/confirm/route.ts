import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where emailed links land (password reset now; invites later). Signs her in
 * from the link, then sends her on to `next`. Handles both link styles:
 *  - ?code=…            Supabase's default email template (PKCE; same browser
 *                       that asked for the link)
 *  - ?token_hash=&type= a custom template linking here directly
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
  redirect(ok ? next : "/forgot-password?expired=1");
}

/** Only same-site paths, so the link can't bounce anyone to another website. */
function safePath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/dashboard";
}
