// Error tracking on the server (user, 2026-11-13; docs/architecture/observability.md). Every error
// worth knowing about is logged as one structured line (for Vercel's logs and the log drain) and
// counted in our own database, grouped by fingerprint, for the admin Site health page (/health).
// The database write uses the server secret (JOBS_SECRET) and gives up after 2 seconds; reporting
// never throws and never breaks the page or action that failed.
//
// Server code only. Not marked "server-only" because src/instrumentation.ts imports it, and that
// file isn't part of the React server bundle.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseConfig } from "@/lib/supabase/env";
import { cleanRoute, errorFingerprint, log, normalizeMessage } from "@/lib/log";

export type ErrorSource = "server" | "action" | "route" | "browser" | "job";

function describe(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name || "Error", message: error.message || "(no message)" };
  if (error && typeof error === "object" && "message" in error) {
    const e = error as { name?: unknown; message?: unknown };
    return { name: typeof e.name === "string" ? e.name : "Error", message: String(e.message) };
  }
  return { name: "Error", message: String(error) };
}

export async function reportError(input: { source: ErrorSource; error: unknown; route?: string | null; digest?: string | null; context?: Record<string, unknown> }) {
  try {
    const { name, message } = describe(input.error);
    const route = cleanRoute(input.route);
    const fingerprint = errorFingerprint(input.source, name, message, route);
    const digest = input.digest && /^[\w-]{1,64}$/.test(input.digest) ? input.digest : null;
    log("error", "error", { source: input.source, name, message, route, digest, fingerprint, ...input.context });

    const secret = process.env.JOBS_SECRET;
    const config = supabaseConfig();
    if (!secret || secret.length < 32 || !config) return;
    const db = createClient<Database>(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db
      .rpc("report_error", {
        p_secret: secret,
        p_fingerprint: fingerprint,
        p_source: input.source,
        p_name: name.slice(0, 120),
        p_message: normalizeMessage(message),
        p_route: route,
        p_digest: digest,
      })
      .abortSignal(AbortSignal.timeout(2000));
    if (error) log("warn", "error.report_failed", { code: error.code, message: error.message });
  } catch (e) {
    log("warn", "error.report_failed", { message: e instanceof Error ? e.message : String(e) });
  }
}
