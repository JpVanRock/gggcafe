import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, EmptyState, Loading, buttonClass, inputClass, pillQuietClass, secondaryButtonClass } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { compareJersey } from "@/lib/softball";
import { loadOwnTeams } from "../data";
import { TeamPicker } from "../team-picker";
import { decideParentLink, removeParentLink, setParentCode } from "./actions";

export const metadata: Metadata = { title: "Parents · Coaches Dugout · GGG.Cafe" };

export default function ParentsPage({ searchParams }: PageProps<"/dugout/parents">) {
  return (
    <Suspense fallback={<Loading />}>
      <Parents searchParams={searchParams} />
    </Suspense>
  );
}

type LinkRow = {
  link_id: string;
  parent_name: string;
  email: string | null;
  child_name: string;
  player_id: string | null;
  status: "pending" | "approved" | "declined";
  requested_at: string;
};
type RosterRow = {
  jersey_number: string | null;
  season: { start_date: string | null } | null;
  player: { id: string; first_name: string; last_name: string; preferred_name: string | null } | null;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

async function Parents({ searchParams }: Pick<PageProps<"/dugout/parents">, "searchParams">) {
  const user = await requireStaffPage();
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

  const [codeResult, linksResult, rosterResult] = await Promise.all([
    supabase.from("teams").select("parent_code").eq("id", team.id).maybeSingle(),
    supabase.rpc("team_parent_links", { p_team_id: team.id }),
    supabase
      .from("roster_entries")
      .select("jersey_number, season:seasons(start_date), player:players(id, first_name, last_name, preferred_name)")
      .eq("team_id", team.id)
      .eq("active", true),
  ]);
  const code = (codeResult.data?.parent_code as string | null) ?? null;
  const links = (linksResult.data ?? []) as LinkRow[];

  // Players to match requests to: the team's active roster, latest season first, once each.
  const seen = new Set<string>();
  const players = ((rosterResult.data ?? []) as unknown as RosterRow[])
    .filter((r) => r.player)
    .sort(
      (a, b) =>
        (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? "") || compareJersey(a.jersey_number, b.jersey_number),
    )
    .filter((r) => !seen.has(r.player!.id) && seen.add(r.player!.id))
    .map((r) => ({
      id: r.player!.id,
      label: `${r.jersey_number ? `#${r.jersey_number} ` : ""}${r.player!.preferred_name || r.player!.first_name} ${r.player!.last_name}`,
      keys: [
        norm(`${r.player!.first_name}${r.player!.last_name}`),
        norm(`${r.player!.preferred_name ?? ""}${r.player!.last_name}`),
      ],
    }));
  const nameOf = new Map(players.map((p) => [p.id, p.label]));
  const guess = (child: string) => players.find((p) => p.keys.includes(norm(child)))?.id ?? "";

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
          <ul className="flex flex-col gap-3">
            {pending.map((l) => (
              <li key={l.link_id} className="rounded-xl border border-pink/50 bg-navy-950/40 p-4">
                <p className="font-semibold">
                  {l.parent_name} <span className="font-normal text-muted">· {l.email}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  Daughter: <span className="text-ink">{l.child_name}</span> · asked {formatDay(l.requested_at.slice(0, 10))}
                </p>
                <form action={decideParentLink} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="link_id" value={l.link_id} />
                  <select name="player_id" required defaultValue={guess(l.child_name)} aria-label={`Which player is ${l.child_name}?`} className={`${inputClass} max-w-xs`}>
                    <option value="" disabled>
                      Which player is she?
                    </option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <button type="submit" name="decision" value="approve" className={buttonClass}>
                    Approve
                  </button>
                  <button type="submit" name="decision" value="decline" formNoValidate className={secondaryButtonClass}>
                    Decline
                  </button>
                </form>
              </li>
            ))}
          </ul>
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
