import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { BudgetSummary, CreditsSummary, type BudgetSummaryData } from "@/components/budget-summary";
import { Badge, Card, EmptyState, badgeClass, eyebrowClass } from "@/components/ui";
import { PACKET_KIND_LABEL, medicalOnFile, type PacketKind } from "@/lib/family";
import { LINK_STATUS, loginStatus, type ParentView } from "@/lib/view-as";
import { AccountFacts, ViewBanner, requireAdminPage } from "../../parts";

export const metadata: Metadata = { title: "View as parent · GGG.Cafe" };

/** Admins: a parent's family page as the parent sees it (read only), to troubleshoot (user, 2026-11-12). */
export default async function ViewAsParentPage({ params }: PageProps<"/view-as/parent/[userId]">) {
  await requireAdminPage();
  const { userId } = await params;
  if (!isUuid(userId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_view_parent", { p_user: userId });
  if (error || !data) notFound();
  const v = data as ParentView;
  const name = v.profile?.display_name ?? v.account.display_name ?? v.account.email ?? "This parent";
  const first = (n: string) => n.split(" ")[0];
  const read = new Set(v.packet_read);
  const mentorName = (id: string) => v.mentors.find((m) => m.user_id === id)?.display_name ?? "A mentor";
  const approvedTeams = v.links.filter((l) => l.status === "approved");

  return (
    <div className="flex flex-col gap-8">
      <ViewBanner who={name} role="parent" />
      <AccountFacts account={v.account} />
      {!v.profile && (
        <p className="rounded-xl border border-pink/60 bg-pink/5 p-4 text-sm">
          No parent profile yet: they signed up but never entered their name and team code, so their family page shows only the &quot;Join your daughter&apos;s
          team&quot; form.
        </p>
      )}

      <Card title="Their teams">
        {v.links.length === 0 ? (
          <EmptyState>No team requests. Their page shows the &quot;Join your daughter&apos;s team&quot; form.</EmptyState>
        ) : (
          <ul className="divide-y divide-navy-800">
            {v.links.map((l) => (
              <li key={l.link_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-semibold">{l.team_name}</p>
                  <p className="text-sm text-muted">
                    Parent of {l.player_name ?? l.child_name}
                    {!l.player_name && l.status !== "approved" && ` (typed as "${l.child_name}")`}
                  </p>
                </div>
                <span className={badgeClass(l.status === "approved" ? "neon" : l.status === "pending" ? "pink" : "neutral")}>{LINK_STATUS[l.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {v.daughters.length > 0 && (
        <Card title={v.daughters.length === 1 ? "Her login" : "Their logins"}>
          <ul className="flex flex-col gap-4">
            {v.daughters.map((d) => {
              const consent = v.consent.find((c) => c.player_id === d.player_id);
              return (
                <li key={d.player_id} className="flex flex-col gap-1">
                  <p className="font-semibold">
                    {d.player_name} <span className="font-normal text-muted">· {d.team_name}</span>
                  </p>
                  <p className="text-sm text-muted">{loginStatus(d)}</p>
                  {consent?.under_13 && (
                    <p className="text-sm">
                      Under 13 · parental consent:{" "}
                      <span className="font-semibold">
                        {consent.status ? `${consent.status}${consent.method ? ` (${consent.method === "video_call" ? "video call" : "signed form"})` : ""}` : "not given yet"}
                      </span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {v.packet.length > 0 && (
        <Card title={`Welcome packet · ${v.packet.filter((i) => read.has(i.id)).length} of ${v.packet.length} read`}>
          <ul className="flex flex-col gap-2">
            {v.packet.map((it) => (
              <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
                <span>
                  <span className={eyebrowClass}>{PACKET_KIND_LABEL[it.kind as PacketKind] ?? it.kind}</span> {it.title}
                </span>
                <span className="text-muted">{read.has(it.id) ? "Read ✓" : "Not read yet"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {v.daughters.map((d) => {
        const mine = v.mentor_links.filter((l) => l.player_id === d.player_id);
        const wholeTeam = v.mentor_links.filter((l) => !l.player_id && l.status === "approved" && approvedTeams.some((t) => t.team_id === l.team_id));
        return (
          <Card key={`forms-${d.player_id}`} title={`${first(d.player_name)}'s season forms and mentors`}>
            <div className="flex flex-col gap-2 text-sm">
              <p>Preseason questionnaire: {d.questionnaire ? <Badge tone="neon">On file</Badge> : <span className="text-muted">not filled in yet</span>}</p>
              <p>Medical &amp; emergency card: {medicalOnFile(d.medical) ? <Badge tone="neon">On file</Badge> : <span className="text-muted">not on file yet</span>}</p>
              <p>
                Mentors:{" "}
                {mine.length + wholeTeam.length === 0 ? (
                  <span className="text-muted">none</span>
                ) : (
                  [...mine, ...wholeTeam]
                    .map((l) => `${mentorName(l.mentor_id)} (${l.player_id ? (l.status === "approved" ? "approved" : "asks to mentor her") : "whole team"})`)
                    .join(", ")
                )}
              </p>
            </div>
          </Card>
        );
      })}

      <p className="text-sm text-muted">
        Yearbook in their menu: {v.yearbook_teams.length ? "yes" : "no"} · Team logo in their header: {v.logos.length ? v.logos[0].team_name : "none"}
      </p>

      {(v.budgets as (BudgetSummaryData | null)[]).filter(Boolean).map((summary) => (
        <section key={summary!.season_id + summary!.team} aria-label={`${summary!.team} Team Budget`} className="flex flex-col gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{summary!.team}</p>
            <h2 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">Team Budget · {summary!.season}</h2>
            <p className="mt-1 text-sm text-muted">View only. Team totals; individual families&apos; payments stay private.</p>
          </div>
          <BudgetSummary summary={summary!} />
          {summary!.credits && summary!.credits.length > 0 && <CreditsSummary credits={summary!.credits} />}
        </section>
      ))}
    </div>
  );
}
