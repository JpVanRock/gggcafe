import "server-only";

// The job worker (docs/architecture/jobs.md). Claims due jobs from the outbox, runs each one, and
// reports back: done, skipped (with why), or failed (the database retries it later with backoff,
// then marks it dead). It talks to the database without a user session, proving itself with the
// jobs secret on every call; the database functions check it (migration 20261113124214).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { requireSupabaseConfig } from "@/lib/supabase/env";
import { APP_TIME_ZONE } from "@/lib/dates";
import { emailConfigured, sendEmail } from "@/lib/email";
import { formatCallTime } from "@/lib/video-calls";
import { deleteZoomMeeting, zoomConfigured } from "@/lib/zoom";
import { errorAlertEmail, isJobKind, jobPayload, mentorCallEmail, videoCallEmail } from "@/lib/jobs/rules";
import { reportError } from "@/lib/errors";
import { logAndKeep } from "@/lib/log-drain";

type Outcome = { outcome: "done" } | { outcome: "skipped"; why: string };
type Db = ReturnType<typeof createClient<Database>>;

const BATCH = 10;
/** Stop claiming more after this long, so one run stays well inside the function's time limit. */
const BUDGET_MS = 20_000;

export type RunSummary = { claimed: number; done: number; skipped: number; failed: number };

export async function runJobs(secret: string, origin: string): Promise<RunSummary> {
  const { url, key } = requireSupabaseConfig();
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const summary: RunSummary = { claimed: 0, done: 0, skipped: 0, failed: 0 };
  const started = Date.now();
  while (Date.now() - started < BUDGET_MS) {
    const { data: jobs, error } = await db.rpc("jobs_claim", { p_secret: secret, p_limit: BATCH });
    if (error) throw new Error(`Couldn't claim jobs: ${error.message}`);
    if (!jobs?.length) break;
    summary.claimed += jobs.length;
    for (const job of jobs) {
      try {
        const result = await runOne(db, secret, origin, job.kind, job.payload);
        await db.rpc("jobs_finish", { p_secret: secret, p_id: job.id, p_outcome: result.outcome, p_note: result.outcome === "skipped" ? result.why : null });
        summary[result.outcome === "done" ? "done" : "skipped"] += 1;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await reportError({ source: "job", error: e, route: job.kind, context: { job: job.id, attempt: job.attempts } });
        await db.rpc("jobs_fail", { p_secret: secret, p_id: job.id, p_error: message });
        summary.failed += 1;
      }
    }
    if (jobs.length < BATCH) break;
  }
  if (summary.claimed) await logAndKeep("info", "jobs.run", { ...summary, ms: Date.now() - started });
  return summary;
}

async function runOne(db: Db, secret: string, origin: string, kind: string, payload: unknown): Promise<Outcome> {
  if (!isJobKind(kind)) return { outcome: "skipped", why: `No handler for ${kind}.` };
  const job = jobPayload(kind, payload);
  if (!job) return { outcome: "skipped", why: "Malformed payload." };

  if (kind === "email.video_call" && "event" in job) {
    if (!emailConfigured()) return { outcome: "skipped", why: "Email isn't set up (RESEND_API_KEY, EMAIL_FROM)." };
    // the invited players' parents, and the mentors a head coach invited (user, 2026-11-22)
    const [parents, mentors] = await Promise.all([
      db.rpc("jobs_video_call_email", { p_secret: secret, p_call_id: job.callId }),
      db.rpc("jobs_video_call_mentor_email", { p_secret: secret, p_call_id: job.callId }),
    ]);
    if (parents.error) throw new Error(`Couldn't read the call: ${parents.error.message}`);
    if (mentors.error) throw new Error(`Couldn't read the call's mentors: ${mentors.error.message}`);
    // one row per invited player (a group call has several; user, 2026-11-14), each with her own parents
    const rows = parents.data ?? [];
    const invited = mentors.data ?? [];
    if (!rows.length) return { outcome: "skipped", why: "The call no longer exists." };
    // a booking that was cancelled before its email went out: the cancellation email covers it
    if (job.event === "booked" && rows[0].cancelled) return { outcome: "skipped", why: "Cancelled before the email went out." };
    if (!rows.some((r) => r.recipients.length) && !invited.length)
      return { outcome: "skipped", why: "No invited player has approved parents with an email, and no mentor with an email was invited." };
    const cancelled = job.event === "cancelled";
    const when = formatCallTime(rows[0].starts_at, APP_TIME_ZONE);
    // one email per person, so nobody sees anyone else's address; each family's names their own daughter
    const sentTo = new Set<string>();
    for (const call of rows) {
      const email = videoCallEmail({
        player: call.player_first,
        hostName: call.host_name,
        hostKind: call.host_kind,
        topic: call.topic,
        when,
        minutes: call.minutes,
        cancelled,
        familyUrl: `${origin}/family`,
        others: rows.length - 1,
      });
      for (const to of call.recipients) {
        if (sentTo.has(to)) continue;
        sentTo.add(to);
        const sent = await sendEmail({ to: [to], ...email });
        if (sent.error) throw new Error(sent.error);
      }
    }
    // each invited mentor (a parent who's also one already has the family's email)
    for (const m of invited) {
      if (sentTo.has(m.email)) continue;
      sentTo.add(m.email);
      const email = mentorCallEmail({
        mentor: m.mentor_name,
        player: m.player_first,
        others: m.group_size - 1,
        hostName: m.host_name,
        topic: m.topic,
        when,
        minutes: m.minutes,
        cancelled,
        callUrl: `${origin}/calls/${job.callId}`,
        mentorUrl: `${origin}/mentor`,
      });
      const sent = await sendEmail({ to: [m.email], ...email });
      if (sent.error) throw new Error(sent.error);
    }
    return { outcome: "done" };
  }

  // a new error: one email per admin (user, 2026-11-14)
  if (kind === "email.error_alert" && "fingerprint" in job) {
    if (!emailConfigured()) return { outcome: "skipped", why: "Email isn't set up (RESEND_API_KEY, EMAIL_FROM)." };
    const { data, error } = await db.rpc("jobs_error_alert", { p_secret: secret, p_fingerprint: job.fingerprint });
    if (error) throw new Error(`Couldn't read the error: ${error.message}`);
    const err = data?.[0];
    if (!err) return { outcome: "skipped", why: "The error is gone (purged)." };
    if (!err.recipients.length) return { outcome: "skipped", why: "No admins with an email." };
    const email = errorAlertEmail({ source: err.source, name: err.name, message: err.message, route: err.route, count: err.count, healthUrl: `${origin}/health` });
    for (const to of err.recipients) {
      const sent = await sendEmail({ to: [to], ...email });
      if (sent.error) throw new Error(sent.error);
    }
    return { outcome: "done" };
  }

  if (kind === "zoom.delete_meeting" && "meetingId" in job) {
    if (!zoomConfigured()) return { outcome: "skipped", why: "Zoom isn't connected." };
    const deleted = await deleteZoomMeeting(job.meetingId);
    if (!deleted.ok) throw new Error(deleted.error);
    return { outcome: "done" };
  }

  return { outcome: "skipped", why: "Malformed payload." };
}
