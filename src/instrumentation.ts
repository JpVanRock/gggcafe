// Server error tracking (user, 2026-11-13; docs/architecture/observability.md): Next.js calls
// onRequestError for errors it catches while rendering pages, in route handlers, in server
// actions that throw, and in proxy.ts. Each is logged and counted (src/lib/errors.ts).
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : null;
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    // the edge runtime: a plain log line is all it gets
    console.error(JSON.stringify({ level: "error", event: "error", source: "server", route: context.routePath, digest, time: new Date().toISOString() }));
    return;
  }
  const { reportError } = await import("@/lib/errors");
  await reportError({
    source: context.routeType === "action" ? "action" : context.routeType === "route" ? "route" : "server",
    error: err,
    route: context.routePath || request.path,
    digest,
    context: { method: request.method, routeType: context.routeType, renderSource: context.renderSource },
  });
};
