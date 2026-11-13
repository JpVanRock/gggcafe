# Outbox and job worker

User, 2026-11-13. This is Phase 1, step 2 of docs/architecture/scaling.md. Work that shouldn't run
inside a request (sending email, cleaning up at Zoom) goes into an outbox. A worker runs it shortly
after, retries what fails, and keeps a record.

## How it works
1. **A change adds a job in the same transaction.**
   - Database triggers call `private.enqueue_job(kind, dedupe_key, payload)`.
   - The jobs live in `private.jobs`, which the API doesn't expose.
   - The same `dedupe_key` twice is one job, so enqueueing can safely happen more than once.
2. **Supabase calls the worker.**
   - Every new job kicks it right away: a statement trigger, then pg_net, sent after the commit.
   - pg_cron also checks every minute (`kick-jobs-worker`), and only calls when jobs are due.
   - The call is `GET <jobs_worker_url>` with `Authorization: Bearer <jobs_secret>`.
3. **The worker** (`src/app/api/jobs/route.ts`, `src/lib/jobs/worker.ts`):
   - Checks the bearer secret against `JOBS_SECRET` (constant-time).
   - Claims up to 10 due jobs with `jobs_claim`. That uses `for update skip locked`, so two workers
     never get the same job, and a job a crashed worker held for 5 minutes comes back.
   - Runs each job, then reports `jobs_finish` (done, or skipped with why) or `jobs_fail` with the
     error.
   - Keeps claiming for up to 20 seconds per run.
4. **Retries:**
   - A failed job waits 1, 2, 4 ... minutes (at most 6 hours) and runs again.
   - After 8 tries it's marked dead, with the last error kept.
   - Finished jobs stay 30 days (`purge-jobs`, daily), then go.

**Security:**
- The worker has no user session and no database password. It calls four functions without
  signing in: `jobs_claim`, `jobs_finish`, `jobs_fail` and `jobs_video_call_email`.
- Each function refuses anyone without the jobs secret. The database compares it with the copy in
  Supabase Vault.
- `tests/db/zz_functions.test.sql` lists them as the only signed-out functions besides sign-up and
  password reset.

## Jobs
| Kind | Added when | Does | Skipped when |
|---|---|---|---|
| `email.video_call` | A video call is booked or cancelled | Emails her approved parents, one email each (no shared addresses) | Email isn't set up; no approved parent has an email; a booking was cancelled before its email went out |
| `zoom.delete_meeting` | A video call is cancelled | Deletes the Zoom meeting; one already gone counts as done | Zoom isn't connected |

**To add a kind:**
1. Enqueue it from a trigger or definer function, with a dedupe key.
2. Add it to `JOB_KINDS` and `jobPayload()` in `src/lib/jobs/rules.ts`, and give it a handler in
   `worker.ts`.
3. If it needs private data (like parents' emails), add a secret-checked function the way
   `jobs_video_call_email` does, and add it to the allowlist in zz_functions.

## Setting it up (once)
Until this is done, jobs wait in the outbox, and nothing breaks.

1. **Make a long random secret.**
   - In a terminal, run `openssl rand -hex 32`. It prints 64 characters.
   - Don't email or text it.
2. **Vercel:**
   - Go to project `gggcafe` → Settings → Environment Variables.
   - Add `JOBS_SECRET` with that value, for Production, marked Sensitive.
   - Then redeploy.
3. **Supabase:**
   - Go to the dashboard → Integrations → Vault → Add new secret.
   - Add two secrets:
     - name `jobs_secret`, value: the same secret;
     - name `jobs_worker_url`, value `https://www.ggg.cafe/api/jobs`. Use the main address: ggg.cafe
       only redirects, and the worker call may not follow a redirect.
   - The SQL editor works too (`select vault.create_secret('<value>', '<name>')`), but it keeps
     query history, so the Vault screen is better for the secret.
4. **For the parent emails:** `RESEND_API_KEY` and `EMAIL_FROM` in Vercel (see src/lib/email.ts).
   Without them, email jobs are recorded as skipped.
5. **Check it:** book and cancel a test video call. Then, in the SQL editor:
   `select kind, outcome, attempts, last_error from private.jobs order by id desc limit 10;`

## Files
- **Database:** `supabase/migrations/20261113124214_jobs_outbox.sql`. Test:
  `tests/db/jobs.test.sql`. The test database stubs Vault in `tests/db/00_supabase_stub.sql`.
- **Worker:** `src/app/api/jobs/route.ts` and `src/lib/jobs/worker.ts`; pure rules and emails in
  `src/lib/jobs/rules.ts`. Unit test: `tests/unit/jobs.test.ts`.
