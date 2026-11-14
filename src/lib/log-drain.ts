// The log drain (user, 2026-11-14; docs/architecture/observability.md): the server keeps its structured
// log lines in our own database for 30 days (migration 20261114214843), where admins read them on the
// Site health page. Vercel's own logs still get every line; this keeps the ones worth looking back at:
// errors, warnings (Zoom, email), emails sent and job runs. Lines are already redacted (src/lib/log.ts).
//
// Server code only. Not marked "server-only" because src/lib/errors.ts uses it, and instrumentation.ts
// imports that outside the React server bundle (where "server-only" would throw).
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { supabaseConfig } from "@/lib/supabase/env";
import { drainEntry, log, type DrainEntry, type LogLevel } from "@/lib/log";

/** Saves lines now: awaited, 2 seconds at most, never throws. Without the server secret, nothing is kept. */
export async function keepLogs(lines: DrainEntry[]): Promise<void> {
  try {
    const secret = process.env.JOBS_SECRET;
    const config = supabaseConfig();
    if (!lines.length || !secret || secret.length < 32 || !config) return;
    const db = createClient<Database>(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    // a plain JSON copy (the database checks each line's shape and size)
    const payload = JSON.parse(JSON.stringify(lines.slice(0, 50))) as Json;
    const { error } = await db.rpc("drain_logs", { p_secret: secret, p_lines: payload }).abortSignal(AbortSignal.timeout(2000));
    // console, not log(): a failing drain mustn't try to drain its own failure
    if (error) console.warn(JSON.stringify({ level: "warn", event: "log.drain_failed", time: new Date().toISOString(), code: error.code, message: error.message }));
  } catch (e) {
    console.warn(JSON.stringify({ level: "warn", event: "log.drain_failed", time: new Date().toISOString(), message: e instanceof Error ? e.message : String(e) }));
  }
}

/** Logs a line (Vercel's logs) and keeps it in the drain, waiting for the save. */
export async function logAndKeep(level: LogLevel, event: string, fields: Record<string, unknown> = {}): Promise<void> {
  log(level, event, fields);
  await keepLogs([drainEntry(level, event, fields)]);
}
