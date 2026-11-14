import type { Metadata } from "next";
import Link from "next/link";
import { canEdit, requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, EmptyState, Disclosure, badgeClass, eyebrowClass } from "@/components/ui";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";
import { ViewToggle } from "../../view-as/parts";
import { removeParentLink, setTeamAdmin } from "./actions";
import { TeamCodeCard } from "../team-code";
import { PendingParentList } from "../approvals";
import { loadTeamApprovals } from "@/lib/approvals";
import { PACKET_KIND_LABEL, type PacketKind } from "@/lib/family";
import { addStarterTips, deletePacketItem } from "./actions";
import { PacketItemForm } from "./packet-forms";
import { ActionForm } from "@/components/action-form";

export const metadata: Metadata = { title: "Parents · Coaches Dugout · GGG.Cafe" };

export default async function ParentsPage({ searchParams }: PageProps<"/dugout/parents">) {
  const user = await requireHeadCoachPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  if (!editor) {
    return (
      <div className="flex flex-col gap-6">
        <TeamPicker teams={teams} current={team.id} basePath="/dugout/parents" />
        <EmptyState>Only coaches and admins manage parent access.</EmptyState>
      </div>
    );
  }

  const admin = user.staff.role === "admin";
  const [codeResult, approvals, parentIds, adminRows] = await Promise.all([
    supabase.from("teams").select("team_code").eq("id", team.id).maybeSingle(),
    loadTeamApprovals(supabase, team.id),
    // whose account each request is: admins' "View as" and the team admin switch (user, 2026-11-12)
    supabase.from("parent_links").select("id, parent_id").eq("team_id", team.id),
    supabase.from("team_admins").select("user_id").eq("team_id", team.id),
  ]);
  const teamAdmins = new Set((adminRows.data ?? []).map((a) => a.user_id));
  const parentOf = new Map(((parentIds.data ?? []) as { id: string; parent_id: string }[]).map((l) => [l.id, l.parent_id]));
  const code = codeResult.data?.team_code ?? null;
  const links = approvals.parentLinks;
  const players = approvals.parentPlayers;
  const nameOf = new Map(players.map((p) => [p.id, p.label]));

  const pending = links.filter((l) => l.status === "pending");
  const approved = links.filter((l) => l.status === "approved");
  const declined = links.filter((l) => l.status === "declined");

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/parents" />
      {/* admins: what this team's parents see, drawn like their family page (user, 2026-11-14) */}
      {admin && (
        <ViewToggle
          kind="parent"
          current="coach"
          coachHref={`/dugout/parents?team=${team.id}`}
          viewHref={approved.length && parentOf.get(approved[0].link_id) ? `/view-as/parent/${parentOf.get(approved[0].link_id)}?team=${team.id}` : null}
        />
      )}

      <TeamCodeCard team={team} code={code} head />

      <Card title={`Waiting for approval (${pending.length})`}>
        {pending.length === 0 ? (
          <EmptyState>No requests waiting.</EmptyState>
        ) : (
          <PendingParentList links={pending} players={players} />
        )}
      </Card>

      <Card title={`Approved parents (${approved.length})`}>
        <p className="-mt-1 mb-3 text-sm text-muted">
          A team admin is a parent who helps run the team: they change the calendar, GameDay (lineups, depth chart, box scores) and players&apos;
          measurements for {team.name}, from a Coaches Dugout with just those tabs. Nothing else opens to them.
        </p>
        {approved.length === 0 ? (
          <EmptyState>No parents approved yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-navy-800">
            {approved.map((l) => (
              <li key={l.link_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-semibold">
                    {l.parent_name} <span className="font-normal text-muted">· {l.email}</span>
                  </p>
                  <p className="text-sm text-muted">Parent of {l.player_id ? (nameOf.get(l.player_id) ?? l.child_name) : l.child_name}</p>
                </div>
                {parentOf.get(l.link_id) && (
                  <ActionForm action={setTeamAdmin} className="flex items-center gap-2">
                    <input type="hidden" name="team_id" value={team.id} />
                    <input type="hidden" name="user_id" value={parentOf.get(l.link_id)} />
                    <input type="hidden" name="on" value={teamAdmins.has(parentOf.get(l.link_id)!) ? "false" : "true"} />
                    {teamAdmins.has(parentOf.get(l.link_id)!) ? (
                      <>
                        <span className={badgeClass("neon")}>Team admin</span>
                        <ConfirmSubmit
                          message={`Take team admin away from ${l.parent_name}? They keep their parent access.`}
                          className="text-xs text-muted hover:text-danger"
                          confirmLabel="Take it away"
                        >
                          Remove
                        </ConfirmSubmit>
                      </>
                    ) : (
                      <ConfirmSubmit
                        message={`Make ${l.parent_name} a team admin? They can change ${team.name}'s calendar, GameDay (lineups, depth chart, box scores) and players' measurements. Nothing else.`}
                        className="text-xs font-semibold text-link hover:underline"
                        confirmLabel="Make team admin"
                        tone="primary"
                      >
                        Make team admin
                      </ConfirmSubmit>
                    )}
                  </ActionForm>
                )}
                {admin && parentOf.get(l.link_id) && (
                  <Link href={`/view-as/parent/${parentOf.get(l.link_id)}`} className="text-xs font-semibold text-link hover:underline" aria-label={`View as ${l.parent_name}`}>
                    View as <span aria-hidden="true">→</span>
                  </Link>
                )}
                <ActionForm action={removeParentLink}>
                  <input type="hidden" name="link_id" value={l.link_id} />
                  <ConfirmSubmit message={`Remove ${l.parent_name}'s access to ${team.name}?`} className="text-xs text-danger hover:underline">
                    Remove access
                  </ConfirmSubmit>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {declined.length > 0 && (
        <Card title={`Declined (${declined.length})`}>
          <ul className="divide-y divide-navy-800">
            {declined.map((l) => (
              <li key={l.link_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  {l.parent_name} <span className="text-muted">· {l.email} · for {l.child_name}</span>
                </span>
                <ActionForm action={removeParentLink}>
                  <input type="hidden" name="link_id" value={l.link_id} />
                  <button type="submit" className="text-xs text-muted hover:text-danger">
                    Clear
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <PacketSection teamId={team.id} />
    </div>
  );
}

// The parent welcome packet (Phase 6): the coach's letter, team policies and "how to
// help her" tips that approved parents read (and mark read) on /family.
async function PacketSection({ teamId }: { teamId: string }) {
  const supabase = await createClient();
  const [{ data: items }, { data: reads }] = await Promise.all([
    supabase.from("parent_packet_items").select("id, kind, title, body, position").eq("team_id", teamId).order("position"),
    supabase.from("parent_packet_reads").select("item_id"),
  ]);
  const list = (items ?? []) as { id: string; kind: PacketKind; title: string; body: string; position: number }[];
  const readCount = (id: string) => ((reads ?? []) as { item_id: string }[]).filter((r) => r.item_id === id).length;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Welcome packet</h2>
      <p className="text-sm text-muted">Approved parents read it on their family page and mark each item read.</p>
      {list.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((it) => (
            <li key={it.id} className="rounded-xl border border-navy-700 p-4">
              <p className={eyebrowClass}>
                {PACKET_KIND_LABEL[it.kind]} · read by {readCount(it.id)}
              </p>
              <p className="mt-1 font-semibold">{it.title}</p>
              <p className="mt-1 line-clamp-3 text-sm whitespace-pre-wrap text-ink/90">{it.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <ActionForm action={deletePacketItem}>
                  <input type="hidden" name="id" value={it.id} />
                  <ConfirmSubmit message={`Remove "${it.title}" from the packet?`} className="text-xs text-muted hover:text-danger">
                    Remove
                  </ConfirmSubmit>
                </ActionForm>
                <div className="w-full">
                  <Disclosure summary="Edit">
                    <PacketItemForm teamId={teamId} item={it} />
                  </Disclosure>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Disclosure summary="Add to the packet" open={list.length === 0}>
        <PacketItemForm teamId={teamId} />
      </Disclosure>
      <ActionForm action={addStarterTips}>
        <input type="hidden" name="team_id" value={teamId} />
        <button type="submit" className="text-sm font-semibold text-link hover:underline">
          + Add the starter &ldquo;how to help her&rdquo; tips
        </button>
      </ActionForm>
    </section>
  );
}
