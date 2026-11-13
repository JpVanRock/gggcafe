// Browser errors land here (src/instrumentation-client.ts; docs/architecture/observability.md).
// Anyone can post, signed in or not, so it's careful: small bodies only, fields checked and cut,
// and at most 30 reports a minute from one address on one server (more are dropped quietly).
// Accepted reports are logged and counted like server errors (src/lib/errors.ts).
import { reportError } from "@/lib/errors";

const MAX_BODY = 4096;
const PER_MINUTE = 30;
const recent = new Map<string, { start: number; count: number }>();

function allow(address: string): boolean {
  const now = Date.now();
  const entry = recent.get(address);
  if (!entry || now - entry.start > 60_000) {
    if (recent.size > 5000) recent.clear(); // a bounded table, even under a flood
    recent.set(address, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= PER_MINUTE;
}

export async function POST(request: Request) {
  const address = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!allow(address)) return new Response(null, { status: 204 });
  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: { name?: unknown; message?: unknown; route?: unknown; stack?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof body.message !== "string" || !body.message.trim()) return new Response(null, { status: 400 });
  const name = typeof body.name === "string" && body.name.trim() ? body.name.slice(0, 120) : "Error";
  const route = typeof body.route === "string" && body.route.startsWith("/") ? body.route : null;
  const firstFrame = typeof body.stack === "string" ? body.stack.split("\n").find((l) => l.includes("at ")) : undefined;
  await reportError({
    source: "browser",
    error: { name, message: body.message.slice(0, 500) },
    route,
    context: firstFrame ? { frame: firstFrame.trim().slice(0, 200) } : undefined,
  });
  return new Response(null, { status: 204 });
}
