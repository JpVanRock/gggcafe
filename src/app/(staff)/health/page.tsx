import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE } from "@/lib/dates";
import { emailConfigured } from "@/lib/email";
import { zoomConfigured } from "@/lib/zoom";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState, PageHeader, TableScroll, tableClass, tdClass, thClass } from "@/components/ui";
import { resolveError } from "./actions";
import { TitleWithTeamLogo } from "@/components/team-logo";

export const metadata: Metadata = { title: "Site health · GGG.Cafe" };

const when = (ts: string | null) =>
  ts ? new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ts)) : "–";

const SOURCE_LABEL: Record<string, string> = { server: "Page", action: "Action", route: "Route", browser: "Browser", job: "Job" };

// Site health (user, 2026-11-13; docs/architecture/observability.md), site admins only: whether the
// outside services are connected, the errors of the last 7 days grouped and counted, and how the
// job worker is doing. Error details never include emails or tokens (src/lib/log.ts).
export default async function HealthPage() {
  const user = await requireStaffPage();
  if (user.staff.role !== "admin") notFound();
  const supabase = await createClient();
  const [{ data: errorRows }, { data: jobRows }] = await Promise.all([supabase.rpc("error_summary", { p_days: 7 }), supabase.rpc("jobs_summary")]);
  const errors = errorRows ?? [];
  const jobs = jobRows ?? [];
  const open = errors.filter((e) => !e.resolved_at);
  const serverSecret = Boolean(process.env.JOBS_SECRET && process.env.JOBS_SECRET.length >= 32);
  const checks = [
    { label: "Server secret", ok: serverSecret, note: "JOBS_SECRET in Vercel and jobs_secret in Supabase Vault: errors are counted here and jobs run once both are set." },
    { label: "Email", ok: emailConfigured(), note: "RESEND_API_KEY and EMAIL_FROM: parent emails for video calls and shared practice plans." },
    { label: "Zoom", ok: zoomConfigured(), note: "The six ZOOM_ keys: video calls." },
  ];

  return (
    <div className="flex flex-col gap-8">
      <TitleWithTeamLogo>
        <PageHeader title="Site health" description={open.length ? `${open.length} open error ${open.length === 1 ? "group" : "groups"} in the last 7 days.` : "No open errors in the last 7 days."} />
      </TitleWithTeamLogo>

      <Card title="Connected services">
        <ul className="flex flex-col divide-y divide-navy-800">
          {checks.map((c) => (
            <li key={c.label} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block font-semibold">{c.label}</span>
                <span className="block text-xs text-muted">{c.note}</span>
              </span>
              <Badge tone={c.ok ? "neon" : "neutral"}>{c.ok ? "Set up" : "Not set up"}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Errors · last 7 days (${errors.length})`}>
        {errors.length === 0 ? (
          <EmptyState>{serverSecret ? "Nothing to show." : "Errors are logged to Vercel now; they're counted here once the server secret is set."}</EmptyState>
        ) : (
          <TableScroll label="Errors">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Last seen</th>
                  <th className={thClass}>Where</th>
                  <th className={thClass}>What</th>
                  <th className={thClass}>Times</th>
                  <th className={thClass}>
                    <span className="sr-only">Resolve</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.fingerprint} className={e.resolved_at ? "text-muted" : ""}>
                    <td className={`${tdClass} whitespace-nowrap font-display tabular-nums`}>{when(e.last_seen)}</td>
                    <td className={tdClass}>
                      <Badge tone="neutral">{SOURCE_LABEL[e.source] ?? e.source}</Badge>
                      <span className="mt-1 block font-mono text-xs break-all">{e.route ?? "–"}</span>
                    </td>
                    <td className={`${tdClass} min-w-56`}>
                      <span className="block font-semibold">{e.name}</span>
                      <span className="block text-xs break-words">{e.message}</span>
                      {e.digest && <span className="block font-mono text-2xs text-muted">digest {e.digest}</span>}
                    </td>
                    <td className={`${tdClass} font-display tabular-nums`}>{e.count}</td>
                    <td className={tdClass}>
                      {e.resolved_at ? (
                        <span className="text-xs">Resolved</span>
                      ) : (
                        <ActionForm action={resolveError}>
                          <input type="hidden" name="fingerprint" value={e.fingerprint} />
                          <SubmitButton variant="link" pendingLabel="Saving…" className="text-xs">
                            Resolve
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
        <p className="mt-3 text-xs text-muted">
          The same error in the same place is one row, counted. Resolve it once fixed; it opens again if it happens again. Groups not seen for 30 days are deleted.
        </p>
      </Card>

      <Card title="Job worker · last 7 days">
        {jobs.length === 0 ? (
          <EmptyState>No jobs yet. Video call emails and Zoom cleanup show here once they run.</EmptyState>
        ) : (
          <TableScroll label="Jobs">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Job</th>
                  <th className={thClass}>Waiting</th>
                  <th className={thClass}>Retrying</th>
                  <th className={thClass}>Done</th>
                  <th className={thClass}>Skipped</th>
                  <th className={thClass}>Failed</th>
                  <th className={thClass}>Latest problem</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.kind}>
                    <td className={`${tdClass} font-mono text-xs`}>{j.kind}</td>
                    <td className={`${tdClass} font-display tabular-nums`}>{j.waiting}</td>
                    <td className={`${tdClass} font-display tabular-nums`}>{j.retrying}</td>
                    <td className={`${tdClass} font-display tabular-nums`}>{j.done}</td>
                    <td className={`${tdClass} font-display tabular-nums`}>{j.skipped}</td>
                    <td className={`${tdClass} font-display tabular-nums`}>{j.dead}</td>
                    <td className={`${tdClass} min-w-56 text-xs`}>{j.last_error ? `${when(j.last_error_at)}: ${j.last_error}` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}
