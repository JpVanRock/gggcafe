import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { requireSupabaseConfig } from "./env";
import { sampleDataEnabled } from "./sample/enabled";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Create a new one per request — never share it across requests.
 * Any component that calls it must render inside <Suspense>.
 */
export async function createClient() {
  // Wait for a real request. Supabase checks token expiry with Date.now(),
  // which Cache Components forbids during (pre)rendering, and auth-dependent
  // data should never be prerendered or prefetched anyway.
  await connection();
  // Sample-data mode (page smoke tests): fictional data, never on Vercel. See ./sample/enabled.ts.
  if (sampleDataEnabled()) return (await import("./sample/client")).sampleClient() as unknown as ReturnType<typeof createServerClient<Database>>;

  const { url, key } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't set cookies. src/proxy.ts refreshes the
          // session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
