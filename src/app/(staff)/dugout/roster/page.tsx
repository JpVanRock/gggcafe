import type { Metadata } from "next";
import Link from "next/link";
import { canEdit, isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Disclosure, EmptyState, pillButtonClass, tableClass, tdClass, thClass, Badge, TableScroll } from "@/components/ui";
import { batsThrows, compareJersey, playerName, type Player, type Season } from "@/lib/softball";
import { loadStaffRequests, loadTeamApprovals } from "@/lib/approvals";
import { seasonOrCurrent } from "@/lib/roster";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";
import { ApprovedClaimList, PendingClaimList, PendingParentList } from "../approvals";
import { LeaderBadge } from "@/components/leader-badge";
import { AdvancedAccessToggle } from "../../players/[playerId]/advanced-client";
import { loadLeaderBadges } from "@/lib/leader-badges";
import { PendingStaffList, StaffList, type StaffMember } from "./staff";
import { TeamCodeCard } from "../team-code";
import { MoveTeamForm, type MoveTeam } from "../../players/move-form";
import { PendingConsentList } from "./consents";
import { CONSENT_BUCKET } from "@/lib/consent";

export const metadata: Metadata = { title: "Roster · Coaches Dugout · GGG.Cafe" };

type RosterRow = { id: string; jersey_number: string | null; active: boolean; player: Player };

function Pill({ tone, children }: { tone: "on" | "wait" | "off"; children: React.ReactNode }) {
  // no account yet: plain grey text, not a chip
  if (tone === "off") return <span className="text-muted">{children}</span>;
  return <Badge tone={tone === "on" ? "neon" : "pink"}>{children}</Badge>;
}

export default async function RosterPage({ searchParams }: PageProps<"/dugout/roster">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  // Head coaches and admins also handle parents and coach sign-ups; assistants don't.
  const head = isHeadCoach(user.staff.role);
  // GGG.Cafe admins also check parents' consent for players under 13 (COPPA), for every team
  const admin = user.staff.role === "admin";
  const { team: teamParam, season: seasonParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const [seasonsResult, currentSeason, approvals, staffRequests, staffResult, codeResult, moveTeamsResult, mentorWaiting, consentsResult] = await Promise.all([
    supabase.from("seasons").select("*").order("start_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    seasonOrCurrent(supabase, team.id, null),
    editor ? loadTeamApprovals(supabase, team.id) : Promise.resolve(null),
    head ? loadStaffRequests(supabase) : Promise.resolve([]),
    supabase.from("staff").select("user_id, display_name, role"),
    editor ? supabase.from("teams").select("team_code").eq("id", team.id).maybeSingle() : Promise.resolve({ data: null }),
    // teams a coach can move a player to (Move a player to another team)
    editor
      ? supabase.from("teams").select("id, name, organization, age_group, is_own_team").order("is_own_team", { ascending: false }).order("name")
      : Promise.resolve({ data: null }),
    head ? supabase.rpc("mentor_requests_waiting").then((r) => Number(r.data ?? 0)) : Promise.resolve(0),
    admin ? supabase.rpc("pending_parental_consents") : Promise.resolve({ data: [] }),
  ]);
  const consents = consentsResult.data ?? [];
  const formPaths = consents.map((c) => c.form_path).filter((p): p is string => Boolean(p));
  const { data: formLinks } = formPaths.length ? await supabase.storage.from(CONSENT_BUCKET).createSignedUrls(formPaths, 600) : { data: [] };
  const formUrls = new Map((formLinks ?? []).flatMap((l) => (l.path && l.signedUrl ? [[l.path, l.signedUrl] as const] : [])));
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

  // Leader Badge: coaches/admins only (the certificates' RLS hides them from view-only staff). G3 Advanced:
  // head coaches and admins unlock it here, not on her pages, which say nothing about it until it's on
  // (user, 2026-11-12).
  const [leaders, { data: g3Rows }] = await Promise.all([
    editor ? loadLeaderBadges(supabase, roster.map((r) => r.player.id)) : Promise.resolve(new Set<string>()),
    head && roster.length
      ? supabase.from("player_advanced_access").select("player_id").in("player_id", roster.map((r) => r.player.id))
      : Promise.resolve({ data: [] as { player_id: string }[] }),
  ]);
  const g3 = new Set((g3Rows ?? []).map((r) => r.player_id));

  const moveTeams = ((moveTeamsResult.data ?? []) as MoveTeam[]).filter((t) => t.id !== team.id);
  const movable = roster.filter((r) => r.active).map((r) => ({ id: r.player.id, label: `${r.jersey_number ? `#${r.jersey_number} ` : ""}${playerName(r.player)}` }));

  const claims = approvals?.claims ?? [];
  const pendingClaims = claims.filter((c) => c.status === "pending");
  const approvedClaims = claims.filter((c) => c.status === "approved");
  const pendingParents = (approvals?.parentLinks ?? []).filter((l) => l.status === "pending");
  const waiting = pendingClaims.length + pendingParents.length + pendingStaff.length + mentorWaiting + consents.length;
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
          <h2 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Waiting for approval ({waiting})</h2>
          {waiting === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing waiting. Players claiming their profile{head ? ", parents asking to join and coaches signing up" : ""} show up here.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-6">
              {consents.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Parental consent to check, players under 13 ({consents.length})</h3>
                  <PendingConsentList consents={consents} formUrls={formUrls} />
                </div>
              )}
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
              {mentorWaiting > 0 && (
                <p className="text-sm">
                  <span className="font-semibold">Mentors asking to work with the whole team ({mentorWaiting})</span>{" "}
                  <Link href={`/dugout/mentors?team=${team.id}`} className="text-link hover:underline">
                    Approve on the Mentors tab →
                  </Link>
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {editor && <TeamCodeCard team={team} code={codeResult.data?.team_code ?? null} head={head} />}

      <Card title={`${season?.name ?? ""} roster (${roster.filter((r) => r.active).length})`}>
        {roster.length === 0 ? (
          <EmptyState>
            No players on this roster yet.
            {editor && " Use Player intake to build it."}
          </EmptyState>
        ) : (
          <TableScroll label="Roster">
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
                  {head && <th className={thClass}>G3 Advanced</th>}
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => {
                  const claim = claimOf.get(r.id);
                  const parents = parentsOf.get(r.player.id) ?? 0;
                  return (
                    <tr key={r.id} className={r.active ? "" : "text-muted"}>
                      <td className={`${tdClass} font-display font-bold tabular-nums`}>{r.jersey_number ?? "–"}</td>
                      <td className={tdClass}>
                        <Link href={`/players/${r.player.id}`} className="font-medium hover:underline">
                          {playerName(r.player)}
                        </Link>
                        {leaders.has(r.player.id) && (
                          <Link
                            href={`/players/${r.player.id}/advanced/leadership/certificate`}
                            className="ml-2 inline-block align-middle"
                            title="Team Leader · completed G3 Leadership"
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
                      {head && (
                        <td className={tdClass}>
                          <span className="flex items-center gap-2">
                            {g3.has(r.player.id) && <Pill tone="on">On</Pill>}
                            <AdvancedAccessToggle playerId={r.player.id} name={r.player.preferred_name || r.player.first_name} on={g3.has(r.player.id)} compact />
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>

      {editor && approvedClaims.length > 0 && (
        <Disclosure summary={`Player accounts (${approvedClaims.length})`}>
          <ApprovedClaimList claims={approvedClaims} spots={approvals!.spots} />
        </Disclosure>
      )}
      {editor && movable.length > 0 && moveTeams.length > 0 && (
        <Disclosure summary="Move a player to another team">
          <MoveTeamForm players={movable} teams={moveTeams} seasons={seasons} />
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
          <Link href={`/dugout/parents?team=${team.id}`} className="text-link hover:underline">
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
    .select("top_size, bottom_size, sock_size, numbers, positions, goals, player:players(first_name, preferred_name, last_name)")
    .eq("team_id", teamId)
    .eq("season_id", seasonId);
  const rows = (data ?? []) as { top_size: string | null; bottom_size: string | null; sock_size: string | null; numbers: string[]; positions: string[]; goals: string | null; player: { first_name: string; preferred_name: string | null; last_name: string } | null }[];
  if (rows.length === 0) return null;
  return (
    <Disclosure summary={`Preseason questionnaires (${rows.length})`}>
      <TableScroll label="Preseason questionnaires">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Player</th>
              <th className={thClass}>Top</th>
              <th className={thClass}>Pants</th>
              <th className={thClass}>Socks</th>
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
                  <td className={tdClass}>{r.sock_size ?? "–"}</td>
                  <td className={`${tdClass} font-display tabular-nums`}>{r.numbers.join(", ") || "–"}</td>
                  <td className={tdClass}>{r.positions.join(", ") || "–"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </TableScroll>
    </Disclosure>
  );
}
