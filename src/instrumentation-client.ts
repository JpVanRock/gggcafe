// Browser error tracking (user, 2026-11-13; docs/architecture/observability.md): uncaught errors and
// unhandled promise rejections go to /api/errors, at most 5 a page load and each message once.
// Only the page's path (no query string), the error's name and message, and the first stack lines
// are sent: nothing typed into forms, no cookies. Errors from browser extensions are ignored.

const MAX_PER_PAGE = 5;
const sent = new Set<string>();

function report(name: string, message: string, stack: string | undefined) {
  try {
    if (sent.size >= MAX_PER_PAGE || sent.has(message)) return;
    if (/ResizeObserver loop|Script error\.?$/.test(message)) return; // browser noise, nothing to act on
    if (stack && /(chrome|moz|safari)-extension:\/\//.test(stack)) return;
    sent.add(message);
    const body = JSON.stringify({
      name: name.slice(0, 120),
      message: message.slice(0, 500),
      route: window.location.pathname,
      stack: (stack ?? "").split("\n").slice(0, 6).join("\n").slice(0, 1200),
    });
    if (!navigator.sendBeacon?.("/api/errors", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/errors", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
  } catch {
    // reporting must never break the page
  }
}

window.addEventListener("error", (event) => {
  const error = event.error as Error | undefined;
  report(error?.name ?? "Error", error?.message ?? event.message ?? "Unknown error", error?.stack ?? (event.filename ? `at ${event.filename}:${event.lineno}` : undefined));
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason as unknown;
  if (reason instanceof Error) report(reason.name, reason.message, reason.stack);
  else report("UnhandledRejection", String(reason), undefined);
});
