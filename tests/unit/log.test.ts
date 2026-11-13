// Run with: npm run test:unit
// Structured logs and error grouping (docs/architecture/observability.md): nothing sensitive gets
// logged, and the same error in the same place gets the same fingerprint.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanRoute, errorFingerprint, logLine, normalizeMessage, redact } from "../../src/lib/log.ts";

test("one JSON line with level, event and time; secrets and emails never get through", () => {
  const line = logLine("error", "job.failed", {
    kind: "email.video_call",
    password: "hunter2",
    JOBS_SECRET: "abc",
    authorization: "Bearer xyz",
    parentEmail: "pat@example.com",
    note: "sent to pat@example.com and lee@example.org",
    nested: { apiKey: "k", ok: 1 },
  }, new Date("2026-11-13T13:20:00Z"));
  const parsed = JSON.parse(line);
  assert.equal(parsed.level, "error");
  assert.equal(parsed.event, "job.failed");
  assert.equal(parsed.time, "2026-11-13T13:20:00.000Z");
  assert.equal(parsed.kind, "email.video_call");
  for (const key of ["password", "JOBS_SECRET", "authorization", "parentEmail"]) assert.equal(parsed[key], "[redacted]", key);
  assert.equal(parsed.note, "sent to [email] and [email]");
  assert.deepEqual(parsed.nested, { apiKey: "[redacted]", ok: 1 });
  assert.doesNotMatch(line, /hunter2|Bearer xyz|example\.com/);
});

test("long strings are cut and deep objects stop", () => {
  assert.equal((redact("x".repeat(900)) as string).length, 500);
  assert.deepEqual(redact({ a: { b: { c: { d: 1 } } } }), { a: { b: { c: "[…]" } } });
  assert.deepEqual(redact(new TypeError("bad for pat@example.com")), { name: "TypeError", message: "bad for [email]" });
});

test("routes lose query strings and ids", () => {
  assert.equal(cleanRoute("/players/eeeeee00-0000-4000-8000-000000000001/pop?tab=1#x"), "/players/[id]/pop");
  assert.equal(cleanRoute("/calls/123456/join"), "/calls/[n]/join");
  assert.equal(cleanRoute(null), null);
});

test("the same error in the same place groups; a different place doesn't", () => {
  assert.equal(normalizeMessage("Row 1234 for eeeeee00-0000-4000-8000-000000000001 failed  twice"), "Row :n for :id failed twice");
  const a = errorFingerprint("server", "TypeError", "Cannot read x of row 12", "/players/eeeeee00-0000-4000-8000-000000000001/pop");
  const b = errorFingerprint("server", "TypeError", "Cannot read x of row 98", "/players/eeeeee00-0000-4000-8000-000000000002/pop?y=1");
  const c = errorFingerprint("server", "TypeError", "Cannot read x of row 12", "/family");
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
});
