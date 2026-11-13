import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/supabase/env";
import { sampleDataEnabled } from "@/lib/supabase/sample/enabled";
import { needsTermsAgreement } from "@/lib/legal";

/** Pages that need a signed-in user. The page itself still checks staff access. */
const PROTECTED_PREFIXES = [
  "/dashboard", "/dugout", "/teams", "/players", "/family", "/me", "/mentor", "/calls",
  "/faq", "/health", "/notifications", "/switchboard", "/view-as",
];

/**
 * Runs before every page request:
 *  - refreshes the Supabase auth session and writes updated cookies
 *    (Server Components can't set cookies themselves)
 *  - sends signed-out visitors away from protected pages, and signed-in
 *    users away from /login
 *  - sends signed-in users who haven't agreed to the current Terms of Service to
 *    /terms/accept first (src/lib/legal.ts)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Sample-data mode (page smoke tests) is signed in as the sample admin: nothing to refresh or guard.
  if (sampleDataEnabled()) return response;

  const config = supabaseConfig();
  if (!config) return response;

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // No-cache headers so a CDN never serves one user's session to another.
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Validates the token and refreshes it if expired. Don't remove.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return redirectKeepingCookies(request, response, "/login");
  }
  if (signedIn && (path === "/login" || path === "/register")) {
    return redirectKeepingCookies(request, response, "/dashboard");
  }
  if (signedIn && needsTermsAgreement(path, request.method, data?.claims?.user_metadata?.terms_version)) {
    const next = path + request.nextUrl.search;
    return redirectKeepingCookies(request, response, "/terms/accept", `?next=${encodeURIComponent(next)}`);
  }

  return response;
}

function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie" && !redirect.headers.has(key)) {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
