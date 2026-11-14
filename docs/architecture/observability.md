# Error tracking, structured logs and the log drain

User, 2026-11-13. This is Phase 1, step 3 of docs/architecture/scaling.md.

## What's built

**Structured logs** (`src/lib/log.ts`):
- Server code logs one JSON object per line: `level`, `event`, `time`, then its fields.
- Vercel's logs, and any log drain, can search and parse them.
- **Nothing sensitive gets in:**
  - keys that look like passwords, secrets, tokens, cookies, API keys, emails, phone numbers or
    signatures are replaced with `[redacted]`;
  - email addresses inside text become `[email]`;
  - strings are cut at 500 characters, and objects stop at 3 levels.

| Event | From | Fields |
|---|---|---|
| `error` | Every tracked error | source, name, message, route, digest, fingerprint (plus method and routeType for server errors; job id and attempt for jobs) |
| `db.error` | A database error with no friendly message (friendlyDbError) | code, message |
| `jobs.run` | Each worker run that did something | claimed, done, skipped, failed, ms |
| `error.report_failed` | Counting an error in the database didn't work | code, message |

**Error tracking:** errors are counted in our own database, not sent to an outside service, so
nothing about players leaves the site.

| Where | How it's caught | Source |
|---|---|---|
| Pages (Server Components) | `onRequestError` in `src/instrumentation.ts` | server |
| Route handlers, proxy.ts | `onRequestError` | route / server |
| Server actions | `runAction` reports unexpected errors and unexpected database errors (`src/lib/actions.ts`); an action that throws reaches `onRequestError` | action |
| The browser | `src/instrumentation-client.ts`: uncaught errors and unhandled rejections | browser |
| The job worker | Each failed job, and a failed run (`src/lib/jobs/worker.ts`, `src/app/api/jobs/route.ts`) | job |

**Browser errors:**
- At most 5 a page load, each message once.
- Only the page path (no query string), the error's name and message, and the top stack lines.
  Nothing typed into forms, and no cookies.
- Extension errors and browser noise are ignored.
- They go to `POST /api/errors`, which takes bodies up to 4 KB and at most 30 reports a minute from
  one address per server.

**Grouping (`src/lib/errors.ts`):**
- The fingerprint is 16 hex characters from the source, the error's name, the message and the
  route.
- Ids and long numbers are replaced first, so the same problem on different players' pages is one
  group.
- Groups live in `private.error_groups`, with a count and first and last seen.

**Writing the groups:**
- Writes go through `report_error`, which checks the server secret, the same one the job worker
  uses (`JOBS_SECRET`, `jobs_secret` in Vault).
- At most 200 new groups an hour are kept.
- Groups not seen for 30 days are deleted (`purge-errors`, daily).
- A report gives up after 2 seconds and never throws.

**The admin Site health page** (`/health`, "Health" in the admins' menu) shows:
- Connected services: the server secret, email, Zoom.
- The errors of the last 7 days, open first, each with **Resolve**. A resolved group opens again if
  it happens again.
- The job worker's week: waiting, retrying, done, skipped and failed per kind, with the latest
  problem.

## Setting it up
- **Error counting needs only the server secret.** That's the same setup as the job worker
  (docs/architecture/jobs.md). Until then, errors are still logged to Vercel; they just aren't
  counted on /health.
- **The log drain is built in** (user, 2026-11-14: "build the log drain", in our own database rather than
  Vercel's Pro-plan drains or an outside service, so nothing about players leaves the site). Nothing to set up
  beyond the server secret. See "The log drain" below.
- **A Vercel log drain** (optional, for every line Vercel sees, including crashes and timeouts the site can't log
  itself) sends Vercel's logs somewhere else as well.
  1. Vercel log drains need a Pro or Enterprise plan.
  2. Pick a destination: Better Stack, Axiom or Datadog all have a Vercel integration, from the
     Vercel Marketplace or the team's Settings → Log Drains.
  3. Add it for the project `gggcafe`, with sources Functions (and Edge, if listed), and the format
     NDJSON or JSON.
  4. The lines are already JSON. Filter on `event` and `level` (for example `level:error`) and set an
     alert for new `error` events.
  5. The destination becomes a service provider that sees technical logs. They contain no emails
     or tokens, but list it in the Privacy notice's providers if you add one.
- **Database logs and slow queries:** in the Supabase dashboard, use Logs (Postgres, API, Auth) and
  Advisors → Query Performance. Supabase's own log drains need a Team plan.

## The log drain (user, 2026-11-14; migration 20261114214843)
- **What's kept:** the lines worth looking back at, written by the server code that logs them with
  `logAndKeep(level, event, fields)` / `keepLogs()` (`src/lib/log-drain.ts`), which logs to Vercel too:
  - `error`: every tracked error (`reportError`, alongside counting it);
  - `zoom.error`: what Zoom said when a call to it failed (`src/lib/zoom.ts`);
  - `email.sent` / `email.failed`: how many recipients and attachments, or the status and Resend's reason
    (never the addresses, subject or body; `src/lib/email.ts`);
  - `jobs.run`: each worker run that did something.
  Lines are shaped by `drainEntry()` in log.ts: route and message lifted out, the rest redacted as above.
- **Where:** `private.log_events`, written only by `drain_logs()` with the server secret (at most 50 lines a
  call and 5,000 an hour; malformed lines are left out), read only by admins through `admin_logs()`
  (level: everything, warnings and errors, errors only; search in the event, message and page; 100 at a
  time, Older → pages back). Purged after 30 days (`purge-logs`, daily at 04:57 UTC).
- **On /health:** a Logs card under the job worker with the level and search filters.
- **Alerts:** `report_error` queues `email.error_alert` when an error is new, or back after it was
  resolved: each admin gets one email with the error and a link to /health, at most one a day per error
  and 10 a day in all (docs/architecture/jobs.md).
- **Saving never gets in the way:** 2 seconds at most, never throws; a failed save is a plain
  `log.drain_failed` console line (not drained again).
- **Privacy:** no new provider (Supabase already holds the data), no emails, tokens or IP addresses, kept
  30 days: within the Privacy notice's "technical logs" (flagged for the attorney's review).

## Files
- **Database:** `supabase/migrations/20261113131948_error_tracking.sql` and `20261114214843_log_drain.sql`.
  Tests: `tests/db/errors.test.sql`, `tests/db/log_drain.test.sql`.
- **App:** `src/lib/log.ts` (unit test `tests/unit/log.test.ts`), `src/lib/errors.ts`, `src/lib/log-drain.ts`,
  `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/app/api/errors/route.ts`, and
  `src/app/(staff)/health/`.
