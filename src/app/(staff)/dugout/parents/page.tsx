import type { Metadata } from "next";
import { canEdit, requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, EmptyState, Disclosure, eyebrowClass } from "@/components/ui";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";
import { removeParentLink } from "./actions";
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

  const [codeResult, approvals] = await Promise.all([
    supabase.from("teams").select("team_code").eq("id", team.id).maybeSingle(),
    loadTeamApprovals(supabase, team.id),
  ]);
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

      <TeamCodeCard team={team} code={code} head />

      <Card title={`Waiting for approval (${pending.length})`}>
        {pending.length === 0 ? (
          <EmptyState>No requests waiting.</EmptyState>
        ) : (
          <PendingParentList links={pending} players={players} />
        )}
      </Card>

      <Card title={`Approved parents (${approved.length})`}>
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
