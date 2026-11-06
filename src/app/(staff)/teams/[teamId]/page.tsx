import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  FORMAT_LABEL, POSITION_LABEL, batsThrows, compareJersey, isUuid, playerName,
  type Player, type Season, type Team,
} from "@/lib/softball";
import {
  Card, Disclosure, EmptyState, Loading, PageHeader, secondaryButtonClass, tableClass, tdClass, thClass,
} from "@/components/ui";
import { removeFromRoster } from "../actions";
import {
  ExistingRosterPlayerForm, NewRosterPlayerForm, RosterEntryEditor, SeasonForm, TeamForm,
} from "../forms";

export const metadata: Metadata = { title: "Team · GGG.Cafe" };

export default function TeamPage({ params, searchParams }: PageProps<"/teams/[teamId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <TeamContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type RosterRow = {
  id: string;
  jersey_number: string | null;
  active: boolean;
  player: Player;
};

async function TeamContent({
  params,
  searchParams,
}: Pick<PageProps<"/teams/[teamId]">, "params" | "searchParams">) {
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
    roster = ((rosterResult.data ?? []) as unknown as RosterRow[]).sort(
      (a, b) => compareJersey(a.jersey_number, b.jersey_number) || a.player.last_name.localeCompare(b.player.last_name),
    );
    const onRoster = new Set(roster.map((r) => r.player.id));
    otherPlayers = ((playersResult.data ?? []) as Pick<Player, "id" | "first_name" | "last_name" | "preferred_name">[])
      .filter((p) => !onRoster.has(p.id))
      .map((p) => ({ id: p.id, label: `${p.last_name}, ${p.preferred_name || p.first_name}` }));
  }

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
        <Card title={`${season.name} roster (${roster.length})`}>
          {roster.length === 0 ? (
            <EmptyState>No players on this roster yet.{editor && " Add them below."}</EmptyState>
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
              <Disclosure summary="Add a new player" open={roster.length === 0}>
                <NewRosterPlayerForm teamId={team.id} seasonId={season.id} />
              </Disclosure>
              {otherPlayers.length > 0 && (
                <Disclosure summary="Add an existing player">
                  <ExistingRosterPlayerForm teamId={team.id} seasonId={season.id} players={otherPlayers} />
                </Disclosure>
              )}
            </div>
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
