import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  FORMAT_LABEL, POSITION_LABEL, batsThrows, compareJersey, isUuid, playerName,
  type Player, type Season, type Team,
} from "@/lib/softball";
import { Card, Disclosure, EmptyState, PageHeader, pillButtonClass, secondaryButtonClass, tableClass, tdClass, thClass } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { addDays, formatDay, formatTime, todayISO } from "@/lib/dates";
import { deleteTeamEvent, removeFromRoster } from "../actions";
import { LogoUpload } from "./logo-upload";
import { ClaimsCard } from "./claims";
import { loadTeamApprovals, type ClaimRow, type SpotOption } from "@/lib/approvals";
import {
  ExistingRosterPlayerForm, GameForm, NewRosterPlayerForm, RosterEntryEditor, SeasonForm, TeamEventForm, TeamForm,
} from "../forms";

export const metadata: Metadata = { title: "Team · GGG.Cafe" };

const EVENT_LABEL: Record<string, string> = {
  practice: "Practice",
  workout: "Workout",
  lesson: "Lesson",
  meeting: "Meeting",
  other: "Event",
};

type RosterRow = {
  id: string;
  jersey_number: string | null;
  active: boolean;
  player: Player;
};

export default async function TeamPage({
  params,
  searchParams,
}: PageProps<"/teams/[teamId]">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { teamId } = await params;
  const { season: seasonParam } = await searchParams;
  if (!isUuid(teamId)) notFound();

  const supabase = await createClient();
  const [teamResult, seasonsResult] = await Promise.all([
    supabase.from("teams").select("*").eq("id", teamId).maybeSingle(),
    supabase
      .from("seasons")
      .select("*")
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);
  const team = teamResult.data as Team | null;
  if (!team) notFound();
  const seasons = (seasonsResult.data ?? []) as Season[];
  const season = seasons.find((s) => s.id === seasonParam) ?? seasons[0] ?? null;

  let roster: RosterRow[] = [];
  let otherPlayers: { id: string; label: string }[] = [];
  if (season) {
    const [rosterResult, playersResult] = await Promise.all([
      supabase
        .from("roster_entries")
        .select("id, jersey_number, active, player:players(*)")
        .eq("team_id", team.id)
        .eq("season_id", season.id),
      editor
        ? supabase.from("players").select("id, first_name, last_name, preferred_name").order("last_name").order("first_name")
        : Promise.resolve({ data: [] }),
    ]);
    roster = ((rosterResult.data ?? []) as RosterRow[]).sort(
      (a, b) => compareJersey(a.jersey_number, b.jersey_number) || a.player.last_name.localeCompare(b.player.last_name),
    );
    const onRoster = new Set(roster.map((r) => r.player.id));
    otherPlayers = ((playersResult.data ?? []) as Pick<Player, "id" | "first_name" | "last_name" | "preferred_name">[])
      .filter((p) => !onRoster.has(p.id))
      .map((p) => ({ id: p.id, label: `${p.last_name}, ${p.preferred_name || p.first_name}` }));
  }

  // Players' account claims (coaches only, our teams)
  const approvals = editor && team.is_own_team ? await loadTeamApprovals(supabase, team.id) : null;
  const claims: ClaimRow[] = approvals?.claims ?? [];
  const spots: SpotOption[] = approvals?.spots ?? [];
  const claimOf = new Map(claims.filter((c) => c.roster_entry_id && c.status !== "declined").map((c) => [c.roster_entry_id!, c.status]));

  // Schedule: the next 8 weeks of practices/events and games
  const today = todayISO();
  const until = addDays(today, 56);
  const [eventsResult, gamesResult, opponentsResult] = await Promise.all([
    supabase
      .from("team_events")
      .select("id, kind, title, event_date, start_time, end_time, location")
      .eq("team_id", team.id)
      .gte("event_date", today)
      .lte("event_date", until),
    supabase
      .from("games")
      .select("id, game_date, start_time, venue, event_name, status, home_team_id, home:teams!home_team_id(name), away:teams!away_team_id(name)")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .gte("game_date", today)
      .lte("game_date", until),
    editor && team.is_own_team
      ? supabase.from("teams").select("id, name").eq("is_own_team", false).order("name")
      : Promise.resolve({ data: [] }),
  ]);
  type ScheduleRow = { key: string; date: string; time: string | null; tag: string; title: string; where: string | null; eventId?: string };
  const schedule: ScheduleRow[] = [
    ...((eventsResult.data ?? []) as { id: string; kind: string; title: string | null; event_date: string; start_time: string | null; end_time: string | null; location: string | null }[]).map((e) => ({
      key: `e${e.id}`,
      date: e.event_date,
      time: [formatTime(e.start_time), formatTime(e.end_time)].filter(Boolean).join("–") || null,
      tag: EVENT_LABEL[e.kind] ?? "Event",
      title: e.title || EVENT_LABEL[e.kind] || "Team event",
      where: e.location,
      eventId: e.id,
    })),
    ...((gamesResult.data ?? []) as { id: string; game_date: string; start_time: string | null; venue: string | null; event_name: string | null; status: string; home_team_id: string; home: { name: string } | null; away: { name: string } | null }[]).map((g) => ({
      key: `g${g.id}`,
      date: g.game_date,
      time: formatTime(g.start_time),
      tag: g.status === "cancelled" ? "Cancelled" : "Game",
      title: g.home_team_id === team.id ? `vs ${g.away?.name ?? "TBD"}` : `@ ${g.home?.name ?? "TBD"}`,
      where: [g.event_name, g.venue].filter(Boolean).join(" · ") || null,
    })),
  ].sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
  const opponents = (opponentsResult.data ?? []) as { id: string; name: string }[];

  const subtitle = [
    team.is_own_team ? "Our team" : "Opponent",
    team.age_group,
    FORMAT_LABEL[team.format],
    team.organization,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={team.name} description={subtitle} back={{ href: "/teams", label: "Teams" }} />

      <Card title="Season">
        {seasons.length === 0 ? (
          <p className="text-sm text-muted">
            Rosters belong to a season. {editor ? "Create the first one below." : "An editor needs to create one."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {seasons.map((s) => (
              <Link
                key={s.id}
                href={`/teams/${team.id}?season=${s.id}`}
                className={`rounded-full border px-3 py-1 text-sm ${
                  s.id === season?.id
                    ? "border-pink bg-pink text-white"
                    : "border-navy-600 hover:bg-navy-800"
                }`}
              >
                {s.name}
              </Link>
            ))}
          </div>
        )}
        {editor && (
          <div className="mt-4">
            <Disclosure summary="New season" open={seasons.length === 0}>
              <SeasonForm teamId={team.id} />
            </Disclosure>
          </div>
        )}
      </Card>

      {season && (
        <Card
          title={`${season.name} roster (${roster.length})`}
          actions={
            editor && team.is_own_team ? (
              <Link href={`/teams/${team.id}/intake?season=${season.id}`} className={pillButtonClass}>
                Player intake →
              </Link>
            ) : undefined
          }
        >
          {roster.length === 0 ? (
            <EmptyState>
              No players on this roster yet.
              {editor && (team.is_own_team ? " Use Player intake to build it." : " Add them below.")}
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>#</th>
                    <th className={thClass}>Player</th>
                    <th className={thClass}>Position</th>
                    <th className={thClass}>B/T</th>
                    <th className={thClass}>Grad</th>
                    {editor && <th className={thClass}><span className="sr-only">Edit</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.id} className={r.active ? "" : "text-muted/70"}>
                      <td className={`${tdClass} tabular-nums`}>{r.jersey_number ?? "–"}</td>
                      <td className={tdClass}>
                        <Link href={`/players/${r.player.id}`} className="font-medium hover:underline">
                          {playerName(r.player)}
                        </Link>
                        {r.player.is_slapper && <span className="ml-2 text-xs text-muted">slapper</span>}
                        {claimOf.get(r.id) && (
                          <span
                            className={`ml-2 rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider uppercase ${
                              claimOf.get(r.id) === "approved" ? "bg-neon text-on-accent" : "border border-pink text-pink-soft"
                            }`}
                          >
                            {claimOf.get(r.id) === "approved" ? "Claimed" : "Claim waiting"}
                          </span>
                        )}
                        {!r.active && <span className="ml-2 text-xs">inactive</span>}
                      </td>
                      <td className={tdClass} title={r.player.primary_position ? POSITION_LABEL[r.player.primary_position] : undefined}>
                        {r.player.primary_position ?? "–"}
                      </td>
                      <td className={tdClass}>{batsThrows(r.player)}</td>
                      <td className={`${tdClass} tabular-nums`}>{r.player.grad_year ?? "–"}</td>
                      {editor && (
                        <td className={tdClass}>
                          <details className="relative">
                            <summary className={`${secondaryButtonClass} cursor-pointer list-none`}>Edit</summary>
                            <div className="mt-2 flex flex-col gap-2 rounded-md border border-navy-700 p-3">
                              <RosterEntryEditor id={r.id} jersey={r.jersey_number} active={r.active} />
                              <form action={removeFromRoster}>
                                <input type="hidden" name="id" value={r.id} />
                                <button type="submit" className="text-xs text-danger hover:underline">
                                  Remove from {season.name} roster
                                </button>
                              </form>
                            </div>
                          </details>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {editor && (
            <div className="mt-4 flex flex-col gap-3">
              {!team.is_own_team && (
                <Disclosure summary="Add a new player" open={roster.length === 0}>
                  <NewRosterPlayerForm teamId={team.id} seasonId={season.id} />
                </Disclosure>
              )}
              {!team.is_own_team && otherPlayers.length > 0 && (
                <Disclosure summary="Add an existing player">
                  <ExistingRosterPlayerForm teamId={team.id} seasonId={season.id} players={otherPlayers} />
                </Disclosure>
              )}
            </div>
          )}
        </Card>
      )}

      {editor && team.is_own_team && <ClaimsCard teamId={team.id} claims={claims} spots={spots} />}

      {team.is_own_team && (
        <Card title="Schedule (next 8 weeks)">
          <p className="mb-4 text-sm text-muted">Practices and games here show up in every rostered player&apos;s TWIS checklist.</p>
          {schedule.length === 0 ? (
            <EmptyState>Nothing scheduled yet.{editor && " Add practices and games below."}</EmptyState>
          ) : (
            <ul className="divide-y divide-navy-800">
              {schedule.map((row) => (
                <li key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="w-28 shrink-0 font-mono text-xs text-highlight uppercase">{formatDay(row.date)}</span>
                  <span
                    className={`rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider uppercase ${
                      row.tag === "Game" ? "bg-neon text-on-accent" : row.tag === "Cancelled" ? "bg-navy-700 text-muted" : "bg-pink text-on-accent"
                    }`}
                  >
                    {row.tag}
                  </span>
                  <span className="font-medium">{row.title}</span>
                  <span className="text-muted">{[row.time, row.where].filter(Boolean).join(" · ")}</span>
                  {editor && row.eventId && (
                    <form action={deleteTeamEvent} className="ml-auto">
                      <input type="hidden" name="id" value={row.eventId} />
                      <ConfirmSubmit
                        message={`Remove ${row.title} on ${formatDay(row.date)}? Players' check-offs for it go too.`}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </ConfirmSubmit>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editor && (
            <div className="mt-4 flex flex-col gap-3">
              <Disclosure summary="Add a practice or team event">
                <TeamEventForm teamId={team.id} />
              </Disclosure>
              <Disclosure summary="Add a game">
                <GameForm teamId={team.id} seasonId={season?.id ?? null} opponents={opponents} />
              </Disclosure>
            </div>
          )}
        </Card>
      )}

      {team.is_own_team && (
        <Card title="Team logo">
          {editor ? (
            <LogoUpload teamId={team.id} logoUrl={team.logo_url} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- remote Storage URL
            <img src={team.logo_url ?? "/brand/ggg-cafe-logo.webp"} alt="Team logo" className="size-20 rounded-full object-contain" />
          )}
        </Card>
      )}

      {editor && (
        <Disclosure summary="Edit team details">
          <TeamForm team={team} />
        </Disclosure>
      )}
      {!editor && team.notes && (
        <Card title="Notes">
          <p className="whitespace-pre-wrap text-sm">{team.notes}</p>
        </Card>
      )}
    </div>
  );
}
