import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { canEdit, requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, EmptyState, Loading, buttonClass, pillQuietClass } from "@/components/ui";
import { loadOwnTeams } from "../data";
import { TeamPicker } from "../team-picker";
import { removeParentLink, setParentCode } from "./actions";
import { PendingParentList } from "../approvals";
import { loadTeamApprovals } from "@/lib/approvals";

export const metadata: Metadata = { title: "Parents · Coaches Dugout · GGG.Cafe" };

export default function ParentsPage({ searchParams }: PageProps<"/dugout/parents">) {
  return (
    <Suspense fallback={<Loading />}>
      <Parents searchParams={searchParams} />
    </Suspense>
  );
}


async function Parents({ searchParams }: Pick<PageProps<"/dugout/parents">, "searchParams">) {
  const user = await requireHeadCoachPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const teams = await loadOwnTeams(supabase);
  if (teams.length === 0) {
    return (
      <EmptyState>
        Add your team on the{" "}
        <Link href="/teams" className="text-pink hover:underline">
          Teams
        </Link>{" "}
        page first.
      </EmptyState>
    );
  }
  const team = teams.find((t) => t.id === teamParam) ?? teams[0];
  if (!editor) {
    return (
      <div className="flex flex-col gap-6">
        <TeamPicker teams={teams} current={team.id} basePath="/dugout/parents" />
        <EmptyState>Only coaches and admins manage parent access.</EmptyState>
      </div>
    );
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "gggcafe.vercel.app";
  const signUpUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}/register`;

  const [codeResult, approvals] = await Promise.all([
    supabase.from("teams").select("parent_code").eq("id", team.id).maybeSingle(),
    loadTeamApprovals(supabase, team.id),
  ]);
  const code = (codeResult.data?.parent_code as string | null) ?? null;
  const links = approvals.parentLinks;
  const players = approvals.parentPlayers;
  const nameOf = new Map(players.map((p) => [p.id, p.label]));

  const pending = links.filter((l) => l.status === "pending");
  const approved = links.filter((l) => l.status === "approved");
  const declined = links.filter((l) => l.status === "declined");

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/parents" />

      <Card title="Parent sign-up">
        {code ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <p className="font-display text-4xl font-bold tracking-[0.2em] text-highlight tabular-nums" aria-label={`Team code ${code.split("").join(" ")}`}>
                {code.slice(0, 3)}-{code.slice(3)}
              </p>
              <div className="flex flex-wrap gap-2">
                <form action={setParentCode}>
                  <input type="hidden" name="team_id" value={team.id} />
                  <ConfirmSubmit message="Make a new code? The old code stops working. Parents already approved keep access." className={pillQuietClass}>
                    New code
                  </ConfirmSubmit>
                </form>
                <form action={setParentCode}>
                  <input type="hidden" name="team_id" value={team.id} />
                  <input type="hidden" name="mode" value="off" />
                  <ConfirmSubmit message="Turn off parent sign-up for this team? Parents already approved keep access." className={pillQuietClass}>
                    Turn off
                  </ConfirmSubmit>
                </form>
              </div>
            </div>
            <p className="text-sm text-muted">
              Send parents this code and the sign-up page, <span className="font-semibold text-ink">{signUpUrl}</span>. They create an
              account, enter the code and their daughter&apos;s name, and you approve them below. Approved parents see the Team Budget as
              team totals only.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">
              Parent sign-up is off for {team.name}. Turn it on to get a team code to send parents.
            </p>
            <form action={setParentCode}>
              <input type="hidden" name="team_id" value={team.id} />
              <button type="submit" className={buttonClass}>
                Turn on parent sign-up
              </button>
            </form>
          </div>
        )}
      </Card>

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
                <form action={removeParentLink}>
                  <input type="hidden" name="link_id" value={l.link_id} />
                  <ConfirmSubmit message={`Remove ${l.parent_name}'s access to ${team.name}?`} className="text-xs text-danger hover:underline">
                    Remove access
                  </ConfirmSubmit>
                </form>
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
                <form action={removeParentLink}>
                  <input type="hidden" name="link_id" value={l.link_id} />
                  <button type="submit" className="text-xs text-muted hover:text-danger">
                    Clear
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
