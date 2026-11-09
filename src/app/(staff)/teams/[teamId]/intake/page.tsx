import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { compareJersey, isUuid, playerName, type Player, type Season, type Team } from "@/lib/softball";
import { Card, Disclosure, EmptyState, PageHeader } from "@/components/ui";
import { IntakeForm } from "../../../players/intake-form";
import { ExistingRosterPlayerForm, SeasonForm } from "../../forms";

export const metadata: Metadata = { title: "Player intake · GGG.Cafe" };

type RosterRow = { id: string; jersey_number: string | null; player: Player };

export default async function IntakePage({ params, searchParams }: PageProps<"/teams/[teamId]/intake">) {
  const user = await requireStaffPage();
  const { teamId } = await params;
  const { season: seasonParam } = await searchParams;
  if (!isUuid(teamId)) notFound();
  if (!canEdit(user.staff.role)) redirect(`/teams/${teamId}`);

  const supabase = await createClient();
  const [teamResult, seasonsResult] = await Promise.all([
    supabase.from("teams").select("*").eq("id", teamId).maybeSingle(),
    supabase.from("seasons").select("*").order("start_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
  ]);
  const team = teamResult.data as Team | null;
  if (!team) notFound();
  if (!team.is_own_team) redirect(`/teams/${teamId}`);
  const seasons = (seasonsResult.data ?? []) as Season[];
  const season = seasons.find((s) => s.id === seasonParam) ?? seasons[0] ?? null;

  const header = (
    <PageHeader
      title="Player intake"
      description={`${team.name}${season ? ` · ${season.name}` : ""}. Build the roster: new players and returning players.`}
      back={{ href: `/teams/${team.id}${season ? `?season=${season.id}` : ""}`, label: team.name }}
    />
  );

  if (!season) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Card title="Start with a season">
          <p className="mb-4 text-sm text-muted">Rosters belong to a season. Create this one, then add players.</p>
          <SeasonForm teamId={team.id} next="intake" />
        </Card>
      </div>
    );
  }

  const [rosterResult, playersResult] = await Promise.all([
    supabase.from("roster_entries").select("id, jersey_number, player:players(*)").eq("team_id", team.id).eq("season_id", season.id),
    supabase.from("players").select("id, first_name, last_name, preferred_name").order("last_name").order("first_name"),
  ]);
  const roster = ((rosterResult.data ?? []) as RosterRow[]).sort(
    (a, b) => compareJersey(a.jersey_number, b.jersey_number) || a.player.last_name.localeCompare(b.player.last_name),
  );
  const onRoster = new Set(roster.map((r) => r.player.id));
  const returning = ((playersResult.data ?? []) as Pick<Player, "id" | "first_name" | "last_name" | "preferred_name">[])
    .filter((p) => !onRoster.has(p.id))
    .map((p) => ({ id: p.id, label: `${p.last_name}, ${p.preferred_name || p.first_name}` }));

  return (
    <div className="flex flex-col gap-6">
      {header}
      {seasons.length > 1 && (
        <nav aria-label="Season" className="flex flex-wrap gap-2">
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={`/teams/${team.id}/intake?season=${s.id}`}
              aria-current={s.id === season.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${s.id === season.id ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"}`}
            >
              {s.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <Card title="New player">
            <IntakeForm teams={[]} fixedTeam={{ id: team.id, seasonId: season.id }} />
          </Card>
          {returning.length > 0 && (
            <Disclosure summary="Returning player (keeps her profile and history)">
              <p className="mb-4 text-sm text-muted">
                Already in GGG.Cafe from a past season or another team? Add her here instead of creating a new profile.
              </p>
              <ExistingRosterPlayerForm teamId={team.id} seasonId={season.id} players={returning} />
            </Disclosure>
          )}
        </div>
        <Card title={`${season.name} roster (${roster.length})`}>
          {roster.length === 0 ? (
            <EmptyState>No players yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-navy-800">
              {roster.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-8 font-display font-bold text-highlight tabular-nums">{r.jersey_number ? `#${r.jersey_number}` : "–"}</span>
                  <Link href={`/players/${r.player.id}`} className="flex-1 font-medium hover:underline">
                    {playerName(r.player)}
                  </Link>
                  <span className="font-mono text-[10px] text-muted">{r.player.primary_position ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
