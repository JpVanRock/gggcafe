// The job worker's address (docs/architecture/jobs.md). Supabase calls it (pg_cron every minute,
// and pg_net as soon as a job is added) with "Authorization: Bearer <JOBS_SECRET>". Anyone else
// gets a 401. It runs the due jobs and says how many.
import { timingSafeEqual } from "node:crypto";
import { runJobs } from "@/lib/jobs/worker";
import { reportError } from "@/lib/errors";

export const maxDuration = 60;

function authorized(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  const secret = process.env.JOBS_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "The job worker isn't set up (JOBS_SECRET)." }, { status: 503 });
  if (!authorized(request.headers.get("authorization"), secret)) return new Response(null, { status: 401 });
  try {
    const summary = await runJobs(secret, new URL(request.url).origin);
    return Response.json(summary);
  } catch (e) {
    await reportError({ source: "job", error: e, route: "/api/jobs" });
    return Response.json({ error: "The job worker couldn't run." }, { status: 500 });
  }
}
