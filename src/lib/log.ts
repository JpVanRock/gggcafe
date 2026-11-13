// Structured logs (user, 2026-11-13; docs/architecture/observability.md). One JSON object per
// line on stdout/stderr, so Vercel's logs and any log drain can search and parse them:
//   {"level":"error","event":"job.failed","time":"2026-11-13T13:20:00.000Z","kind":"zoom.delete_meeting",...}
// Nothing sensitive goes in: keys that look like secrets or emails are redacted, email addresses
// inside text are masked, and long strings are cut. Also the error fingerprint used to group
// errors (src/lib/errors.ts). No imports, so the browser, the server and the unit tests share it.

export type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|e-?mail|zak|signature|phone/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAX_STRING = 500;

/** A copy safe to log: sensitive keys redacted, emails masked, strings cut, depth limited. */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.replace(EMAIL, "[email]").slice(0, MAX_STRING);
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return value;
  if (value instanceof Error) return { name: value.name, message: redact(value.message) };
  if (depth >= 3) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, MAX_STRING);
}

export function logLine(level: LogLevel, event: string, fields: Record<string, unknown> = {}, now: Date = new Date()): string {
  return JSON.stringify({ level, event, time: now.toISOString(), ...(redact(fields) as Record<string, unknown>) });
}

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = logLine(level, event, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** A route without its query string or hash, ids replaced, so the same page groups together. */
export function cleanRoute(path: string | null | undefined): string | null {
  if (!path) return null;
  const bare = path.split(/[?#]/)[0].replace(UUID, "[id]").replace(/\/\d+(?=\/|$)/g, "/[n]");
  return bare.slice(0, 200) || "/";
}

/** An error message for grouping: emails masked; ids, long numbers and hex replaced; cut short. */
export function normalizeMessage(message: string): string {
  return (
    message
      .replace(EMAIL, "[email]")
      .replace(UUID, ":id")
      .replace(/\b[0-9a-f]{12,}\b/gi, ":hex")
      .replace(/\d{2,}/g, ":n")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300) || "(no message)"
  );
}

/** 16 hex characters for (source, name, message, route): the same error in the same place groups together. */
export function errorFingerprint(source: string, name: string, message: string, route: string | null): string {
  const text = [source, name, normalizeMessage(message), cleanRoute(route) ?? ""].join("|");
  // two 32-bit FNV-1a hashes with different seeds: stable, quick, no imports
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x01234567);
}
