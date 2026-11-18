import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE } from "@/lib/dates";
import { emailConfigured } from "@/lib/email";
import { zoomConfigured } from "@/lib/zoom";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import Link from "next/link";
import { Badge, Card, EmptyState, Field, PageHeader, TableScroll, buttonStyles, fieldClass, tableClass, tdClass, thClass } from "@/components/ui";
import { resolveError } from "./actions";
import { TitleWithTeamLogo } from "@/components/team-logo";

export const metadata: Metadata = { title: "Site health · GGG.Cafe" };

const when = (ts: string | null) =>
  ts ? new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ts)) : "–";

const SOURCE_LABEL: Record<string, string> = { server: "Page", action: "Action", route: "Route", browser: "Browser", job: "Job" };

// Site health (user, 2026-11-13; docs/architecture/observability.md), site admins only: whether the
// outside services are connected, the errors of the last 7 days grouped and counted, and how the
// job worker is doing. Error details never include emails or tokens (src/lib/log.ts). The log drain
// (user, 2026-11-14): the kept log lines of the last 30 days, by level and search, 100 at a time.
const LOG_LEVELS = [
  { key: "", label: "Everything" },
  { key: "warn", label: "Warnings and errors" },
  { key: "error", label: "Errors only" },
] as const;
const LOG_TONE: Record<string, "pink" | "neon" | "neutral"> = { error: "pink", warn: "neon", info: "neutral" };
const PAGE = 100;

/** A line's other fields, short: "status: 422 · recipients: 2". */
function details(fields: unknown): string {
  if (!fields || typeof fields !== "object") return "";
  return Object.entries(fields as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${v !== null && typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ")
    .slice(0, 300);
}

export default async function HealthPage({ searchParams }: PageProps<"/health">) {
  const user = await requireStaffPage();
  if (user.staff.role !== "admin") notFound();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const level = LOG_LEVELS.some((l) => l.key === one(params.logs)) ? one(params.logs) : "";
  const search = one(params.q).trim().slice(0, 100);
  const before = /^\d{1,18}$/.test(one(params.before)) ? Number(one(params.before)) : null;
  const supabase = await createClient();
  const [{ data: errorRows }, { data: jobRows }, { data: logRows }] = await Promise.all([
    supabase.rpc("error_summary", { p_days: 7 }),
    supabase.rpc("jobs_summary"),
    supabase.rpc("admin_logs", { p_level: level || undefined, p_search: search || undefined, p_before: before ?? undefined, p_limit: PAGE }),
  ]);
  const logs = logRows ?? [];
  const logHref = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...(level ? { logs: level } : {}), ...(search ? { q: search } : {}), ...extra });
    const text = q.toString();
    return `/health${text ? `?${text}` : ""}#logs`;
  };
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
                      <span className="mt-1 block font-sans text-xs break-all">{e.route ?? "–"}</span>
                    </td>
                    <td className={`${tdClass} min-w-56`}>
                      <span className="block font-semibold">{e.name}</span>
                      <span className="block text-xs break-words">{e.message}</span>
                      {e.digest && <span className="block font-sans text-2xs text-muted">digest {e.digest}</span>}
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
                    <td className={`${tdClass} font-sans text-xs`}>{j.kind}</td>
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

      <section id="logs" className="scroll-mt-24">
        <Card title={`Logs · last 30 days${logs.length ? ` (${logs.length}${logs.length === PAGE ? "+" : ""}${before ? ", older" : ""})` : ""}`}>
          <form method="get" action="/health#logs" className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Show">
              <select name="logs" defaultValue={level} className={`${fieldClass} w-56`}>
                {LOG_LEVELS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Search">
              <input name="q" defaultValue={search} maxLength={100} placeholder="zoom, email, /players…" className={`${fieldClass} w-64`} />
            </Field>
            <button type="submit" className={buttonStyles("secondary")}>
              Filter
            </button>
            {(level || search || before) && (
              <Link href="/health#logs" className="text-sm text-link hover:underline">
                Clear
              </Link>
            )}
          </form>
          {logs.length === 0 ? (
            <EmptyState>
              {!serverSecret ? "Log lines are kept here once the server secret is set." : level || search || before ? "Nothing matches." : "No log lines yet."}
            </EmptyState>
          ) : (
            <TableScroll label="Logs">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Time</th>
                    <th className={thClass}>Level</th>
                    <th className={thClass}>Event</th>
                    <th className={thClass}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className={`${tdClass} whitespace-nowrap font-display tabular-nums`}>{when(l.at)}</td>
                      <td className={tdClass}>
                        <Badge tone={LOG_TONE[l.level] ?? "neutral"}>{l.level}</Badge>
                      </td>
                      <td className={tdClass}>
                        <span className="block font-sans text-xs">{l.event}</span>
                        {l.route && <span className="mt-1 block font-sans text-xs break-all text-muted">{l.route}</span>}
                      </td>
                      <td className={`${tdClass} min-w-56`}>
                        {l.message && <span className="block text-xs break-words">{l.message}</span>}
                        {details(l.fields) && <span className="block text-xs break-words text-muted">{details(l.fields)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Errors, Zoom and email problems, emails sent (how many, never to whom) and job runs, kept 30 days. Emails, tokens and secrets are taken out before
              anything is saved.
            </p>
            <span className="flex gap-4 text-sm">
              {before && (
                <Link href={logHref({})} className="text-link hover:underline">
                  ← Newest
                </Link>
              )}
              {logs.length === PAGE && (
                <Link href={logHref({ before: String(logs[logs.length - 1].id) })} className="text-link hover:underline">
                  Older →
                </Link>
              )}
            </span>
          </div>
        </Card>
      </section>
    </div>
  );
}
