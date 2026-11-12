import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDay } from "@/lib/dates";
import { isUuid } from "@/lib/softball";
import { Badge, Card, EmptyState, tableClass, tdClass, thClass, TableScroll } from "@/components/ui";
import type { MentorView } from "@/lib/view-as";
import { AccountFacts, ViewBanner, requireAdminPage } from "../../parts";

export const metadata: Metadata = { title: "View as mentor · GGG.Cafe" };

const STATUS: Record<string, string> = { approved: "Approved", pending: "Waiting", declined: "Declined" };

/** Admins: a mentor's home as the mentor sees it (read only), to troubleshoot (user, 2026-11-12). */
export default async function ViewAsMentorPage({ params }: PageProps<"/view-as/mentor/[userId]">) {
  await requireAdminPage();
  const { userId } = await params;
  if (!isUuid(userId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_view_mentor", { p_user: userId });
  if (error || !data) notFound();
  const v = data as MentorView;
  const name = v.mentor?.display_name ?? v.account.display_name ?? v.account.email ?? "This mentor";
  const playerName = (id: string) => v.players.find((p) => p.id === id)?.name ?? "A player she can't see";

  return (
    <div className="flex flex-col gap-8">
      <ViewBanner who={name} role="mentor" />
      <AccountFacts account={v.account} />
      <p className="text-sm">
        {v.mentor ? (
          <>
            Mentor profile: <span className="font-semibold">{v.mentor.specialty ?? "Mentor"}</span> · {v.players.length} player
            {v.players.length === 1 ? "" : "s"} they can see · {v.notes} note{v.notes === 1 ? "" : "s"} with coaches · {v.focus} focus area
            {v.focus === 1 ? "" : "s"}
          </>
        ) : (
          <span className="text-muted">No mentor profile yet: they haven&apos;t sent a request with a team code, so their home shows only the request form.</span>
        )}
      </p>

      <Card title={`Requests (${v.links.length})`}>
        {v.links.length === 0 ? (
          <EmptyState>No requests.</EmptyState>
        ) : (
          <ul className="divide-y divide-navy-800">
            {v.links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  {l.player_id ? `${l.player_name ?? "A player"} (one player)` : "The whole team"} · {l.team_name ?? "a team"}
                  <span className="text-muted"> · asked {formatDay(l.requested_at.slice(0, 10))}</span>
                </span>
                <Badge tone={l.status === "approved" ? "neon" : l.status === "pending" ? "pink" : "neutral"}>{STATUS[l.status] ?? l.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Players they can see (${v.players.length})`}>
        {v.players.length === 0 ? (
          <EmptyState>None. Until a parent or a head coach approves a request, a mentor sees no players.</EmptyState>
        ) : (
          <TableScroll label="Players they can see">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Player</th>
                  <th className={thClass}>Pos</th>
                  <th className={thClass}>Team</th>
                </tr>
              </thead>
              <tbody>
                {v.players.map((p) => (
                  <tr key={p.id}>
                    <td className={`${tdClass} font-display tabular-nums`}>{p.jersey ?? "–"}</td>
                    <td className={tdClass}>{p.name}</td>
                    <td className={tdClass}>{p.position ?? "–"}</td>
                    <td className={tdClass}>{p.team ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      <Card title={`Messages they sent (${v.messages.length}${v.messages.length === 20 ? ", latest" : ""})`}>
        {v.messages.length === 0 ? (
          <EmptyState>No messages yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-navy-800">
            {v.messages.map((m, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="w-24 shrink-0 text-muted">{formatDay(m.created_at.slice(0, 10))}</span>
                <span className="font-semibold">{playerName(m.player_id)}</span>
                <span className="min-w-0 flex-1 text-ink/90">
                  {[m.body, m.drill_name && `Drill: ${m.drill_name}`, m.has_photo && "Photo"].filter(Boolean).join(" · ")}
                </span>
                <span className="text-xs text-muted">
                  {m.shared_with_coaches ? "Shared with coaches" : "Private"} · {m.read_at ? "Seen" : "Not seen yet"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Upcoming training they added (${v.training.length})`}>
        {v.training.length === 0 ? (
          <EmptyState>Nothing upcoming.</EmptyState>
        ) : (
          <ul className="divide-y divide-navy-800">
            {v.training.map((t, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="w-40 shrink-0 text-muted">
                  {formatDay(t.starts_on)}
                  {t.ends_on !== t.starts_on && ` – ${formatDay(t.ends_on)}`}
                </span>
                <span className="font-semibold">{t.title}</span>
                <span className="text-muted">{playerName(t.player_id)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
