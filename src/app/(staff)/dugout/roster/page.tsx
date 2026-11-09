import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Disclosure, EmptyState, Loading, pillButtonClass, tableClass, tdClass, thClass } from "@/components/ui";
import { batsThrows, compareJersey, playerName, type Player, type Season } from "@/lib/softball";
import { loadStaffRequests, loadTeamApprovals } from "@/lib/approvals";
import { seasonOrCurrent } from "@/lib/roster";
import { loadOwnTeams } from "../data";
import { TeamPicker, pickTeam } from "../team-picker";
import { ApprovedClaimList, PendingClaimList, PendingParentList } from "../approvals";
import { LeaderBadge } from "@/components/leader-badge";
import { loadLeaderBadges } from "@/lib/leader-badges";
import { PendingStaffList, StaffList, type StaffMember } from "./staff";

export const metadata: Metadata = { title: "Roster · Coaches Dugout · GGG.Cafe" };

export default function RosterPage({ searchParams }: PageProps<"/dugout/roster">) {
  return (
    <Suspense fallback={<Loading />}>
      <Roster searchParams={searchParams} />
    </Suspense>
  );
}

type RosterRow = { id: string; jersey_number: string | null; active: boolean; player: Player };

function Pill({ tone, children }: { tone: "on" | "wait" | "off"; children: React.ReactNode }) {
  const cls = tone === "on" ? "bg-neon text-on-accent" : tone === "wait" ? "border border-pink text-pink-soft" : "text-muted";
  return <span className={`rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider uppercase ${cls}`}>{children}</span>;
}

async function Roster({ searchParams }: Pick<PageProps<"/dugout/roster">, "searchParams">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  // Head coaches and admins also handle parents and coach sign-ups; assistants don't.
  const head = isHeadCoach(user.staff.role);
  const { team: teamParam, season: seasonParam } = await searchParams;
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
  const team = pickTeam(teams, teamParam);
  const [seasonsResult, currentSeason, approvals, staffRequests, staffResult] = await Promise.all([
    supabase.from("seasons").select("*").order("start_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    seasonOrCurrent(supabase, team.id, null),
    editor ? loadTeamApprovals(supabase, team.id) : Promise.resolve(null),
    head ? loadStaffRequests(supabase) : Promise.resolve([]),
    supabase.from("staff").select("user_id, display_name, role"),
  ]);
  // Coach sign-ups for this team, plus head-coach sign-ups (no team; admins only)
  const pendingStaff = staffRequests.filter((r) => r.team_id === team.id || r.team_id === null);
  const staff = (staffResult.data ?? []) as StaffMember[];
  const seasons = (seasonsResult.data ?? []) as Season[];
  const season = seasons.find((s) => s.id === seasonParam) ?? seasons.find((s) => s.id === currentSeason) ?? seasons[0] ?? null;

  const { data: rosterData } = season
    ? await supabase.from("roster_entries").select("id, jersey_number, active, player:players(*)").eq("team_id", team.id).eq("season_id", season.id)
    : { data: [] };
  const roster = ((rosterData ?? []) as RosterRow[])
    .filter((r) => r.player)
    .sort((a, b) => Number(b.active) - Number(a.active) || compareJersey(a.jersey_number, b.jersey_number) || a.player.last_name.localeCompare(b.player.last_name));

  // Leader Badge: coaches/admins only (the certificates' RLS hides them from view-only staff)
  const leaders = editor ? await loadLeaderBadges(supabase, roster.map((r) => r.player.id)) : new Set<string>();

  const claims = approvals?.claims ?? [];
  const pendingClaims = claims.filter((c) => c.status === "pending");
  const approvedClaims = claims.filter((c) => c.status === "approved");
  const pendingParents = (approvals?.parentLinks ?? []).filter((l) => l.status === "pending");
  const waiting = pendingClaims.length + pendingParents.length + pendingStaff.length;
  const claimOf = new Map(claims.filter((c) => c.roster_entry_id && c.status !== "declined").map((c) => [c.roster_entry_id!, c.status]));
  const parentsOf = new Map<string, number>();
  for (const l of approvals?.parentLinks ?? []) if (l.status === "approved" && l.player_id) parentsOf.set(l.player_id, (parentsOf.get(l.player_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/roster" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">{season?.name ?? "Roster"}</h2>
          <p className="mt-1 text-sm text-muted">{team.name} · Roster</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {seasons.length > 1 && (
            <nav aria-label="Season" className="flex flex-wrap gap-1.5">
              {seasons.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  href={`/dugout/roster?team=${team.id}&season=${s.id}`}
                  aria-current={s.id === season?.id ? "page" : undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    s.id === season?.id ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
                  }`}
                >
                  {s.name}
                </Link>
              ))}
            </nav>
          )}
          {editor && (
            <Link href={`/teams/${team.id}/intake${season ? `?season=${season.id}` : ""}`} className={pillButtonClass}>
              Player intake →
            </Link>
          )}
        </div>
      </div>

      {editor && (
        <section id="waiting" aria-label="Waiting for approval" className={`rounded-2xl border p-4 sm:p-5 ${waiting ? "border-pink/60 bg-pink/5" : "border-navy-700 bg-navy-900/60"}`}>
          <h2 className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Waiting for approval ({waiting})</h2>
          {waiting === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing waiting. Players claiming their profile{head ? ", parents asking to join and coaches signing up" : ""} show up here.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-6">
              {pendingStaff.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Coaches signing up ({pendingStaff.length})</h3>
                  <PendingStaffList requests={pendingStaff} />
                </div>
              )}
              {pendingClaims.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Players claiming their profile ({pendingClaims.length})</h3>
                  <PendingClaimList claims={pendingClaims} spots={approvals!.spots} />
                </div>
              )}
              {pendingParents.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Parents asking to join ({pendingParents.length})</h3>
                  <PendingParentList links={pendingParents} players={approvals!.parentPlayers} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <Card title={`${season?.name ?? ""} roster (${roster.filter((r) => r.active).length})`}>
        {roster.length === 0 ? (
          <EmptyState>
            No players on this roster yet.
            {editor && " Use Player intake to build it."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Player</th>
                  <th className={thClass}>Pos</th>
                  <th className={thClass}>B/T</th>
                  <th className={thClass}>Class</th>
                  {editor && <th className={thClass}>Player account</th>}
                  {head && <th className={thClass}>Parents</th>}
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => {
                  const claim = claimOf.get(r.id);
                  const parents = parentsOf.get(r.player.id) ?? 0;
                  return (
                    <tr key={r.id} className={r.active ? "" : "text-muted/70"}>
                      <td className={`${tdClass} font-display font-bold tabular-nums`}>{r.jersey_number ?? "–"}</td>
                      <td className={tdClass}>
                        <Link href={`/players/${r.player.id}`} className="font-medium hover:underline">
                          {playerName(r.player)}
                        </Link>
                        {leaders.has(r.player.id) && (
                          <Link
                            href={`/players/${r.player.id}/advanced/leadership/certificate`}
                            className="ml-2 inline-block align-middle"
                            title="Team Leader · completed the G3 Leadership Guide"
                          >
                            <LeaderBadge size={20} />
                          </Link>
                        )}
                        {!r.active && <span className="ml-2 text-xs">inactive</span>}
                      </td>
                      <td className={tdClass}>{[r.player.primary_position, ...r.player.secondary_positions].filter(Boolean).slice(0, 3).join(", ") || "–"}</td>
                      <td className={tdClass}>{batsThrows(r.player)}</td>
                      <td className={`${tdClass} tabular-nums`}>{r.player.grad_year ?? "–"}</td>
                      {editor && (
                        <td className={tdClass}>
                          {claim === "approved" ? <Pill tone="on">Claimed</Pill> : claim === "pending" ? <Pill tone="wait">Waiting</Pill> : <Pill tone="off">—</Pill>}
                        </td>
                      )}
                      {head && <td className={`${tdClass} tabular-nums`}>{parents || "–"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editor && approvedClaims.length > 0 && (
        <Disclosure summary={`Player accounts (${approvedClaims.length})`}>
          <ApprovedClaimList claims={approvedClaims} spots={approvals!.spots} />
        </Disclosure>
      )}
      {staff.length > 0 && (
        <Disclosure summary={`Coaching staff (${staff.length})`}>
          <StaffList staff={staff} isAdmin={user.staff.role === "admin"} meId={user.id} />
        </Disclosure>
      )}
      <div className="flex flex-wrap gap-3">
        <Link href={`/dugout/roster/staff?team=${team.id}`} className={pillButtonClass}>
          Staff duties & standards →
        </Link>
        {head && (
          <Link href={`/dugout/roster/medical?team=${team.id}`} className={pillButtonClass}>
            Medical cards →
          </Link>
        )}
      </div>
      {editor && <QuestionnaireTable teamId={team.id} seasonId={season?.id ?? null} />}
      {head && (
        <p className="text-xs text-muted">
          Parent sign-up codes and approved parents are on the{" "}
          <Link href={`/dugout/parents?team=${team.id}`} className="text-pink hover:underline">
            Parents
          </Link>{" "}
          tab.
        </p>
      )}
    </div>
  );
}


// Preseason questionnaires (Phase 6): sizes, number choices and the positions she wants, for coaches.
async function QuestionnaireTable({ teamId, seasonId }: { teamId: string; seasonId: string | null }) {
  if (!seasonId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("player_questionnaires")
    .select("top_size, bottom_size, jacket_size, hat_size, numbers, positions, goals, player:players(first_name, preferred_name, last_name)")
    .eq("team_id", teamId)
    .eq("season_id", seasonId);
  const rows = (data ?? []) as { top_size: string | null; bottom_size: string | null; jacket_size: string | null; hat_size: string | null; numbers: string[]; positions: string[]; goals: string | null; player: { first_name: string; preferred_name: string | null; last_name: string } | null }[];
  if (rows.length === 0) return null;
  return (
    <Disclosure summary={`Preseason questionnaires (${rows.length})`}>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Player</th>
              <th className={thClass}>Top</th>
              <th className={thClass}>Pants</th>
              <th className={thClass}>Jacket</th>
              <th className={thClass}>Hat</th>
              <th className={thClass}>Numbers</th>
              <th className={thClass}>Wants to play</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((r) => r.player)
              .sort((a, b) => a.player!.last_name.localeCompare(b.player!.last_name))
              .map((r, i) => (
                <tr key={i}>
                  <td className={tdClass}>{playerName(r.player!)}</td>
                  <td className={tdClass}>{r.top_size ?? "–"}</td>
                  <td className={tdClass}>{r.bottom_size ?? "–"}</td>
                  <td className={tdClass}>{r.jacket_size ?? "–"}</td>
                  <td className={tdClass}>{r.hat_size ?? "–"}</td>
                  <td className={`${tdClass} font-display tabular-nums`}>{r.numbers.join(", ") || "–"}</td>
                  <td className={tdClass}>{r.positions.join(", ") || "–"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Disclosure>
  );
}
