import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { POSITION_LABEL, batsThrows, playerName, type Player } from "@/lib/softball";
import {
  Card, Disclosure, EmptyState, Loading, PageHeader, buttonClass, inputClass, tableClass, tdClass, thClass,
} from "@/components/ui";
import { PlayerForm } from "./player-form";

export const metadata: Metadata = { title: "Players · GGG.Cafe" };

export default function PlayersPage({ searchParams }: PageProps<"/players">) {
  return (
    <>
      <PageHeader title="Players" description="Everyone in the database: your players and the opponents you track." />
      <Suspense fallback={<Loading />}>
        <PlayersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type PlayerRow = Player & {
  roster_entries: {
    jersey_number: string | null;
    team: { id: string; name: string; short_name: string | null; is_own_team: boolean } | null;
    season: { name: string; start_date: string | null } | null;
  }[];
};

async function PlayersContent({ searchParams }: Pick<PageProps<"/players">, "searchParams">) {
  const user = await requireStaffPage();
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select(
      "*, roster_entries(jersey_number, team:teams(id, name, short_name, is_own_team), season:seasons(name, start_date))",
    )
    .order("last_name")
    .order("first_name")
    .limit(2000);
  if (error) throw new Error(error.message);

  const all = (data ?? []) as PlayerRow[];
  const players = query
    ? all.filter((p) =>
        [p.first_name, p.last_name, p.preferred_name].some((n) => n?.toLowerCase().includes(query)),
      )
    : all;

  return (
    <div className="flex flex-col gap-6">
      {canEdit(user.staff.role) && (
        <Disclosure summary="Add a player" open={all.length === 0}>
          <p className="mb-4 text-sm text-muted">
            Tip: to add someone straight onto a team, use &ldquo;Add a new player&rdquo; on the team&apos;s page.
          </p>
          <PlayerForm />
        </Disclosure>
      )}

      <Card title={query ? `Players matching “${query}” (${players.length})` : `All players (${all.length})`}>
        <form className="mb-4 flex gap-2" role="search">
          <input name="q" defaultValue={query} placeholder="Search by name" aria-label="Search players" className={`${inputClass} max-w-xs`} />
          <button type="submit" className={buttonClass}>Search</button>
          {query && (
            <Link href="/players" className="self-center text-sm text-muted hover:underline">Clear</Link>
          )}
        </form>

        {players.length === 0 ? (
          <EmptyState>{query ? "No players match that name." : "No players yet."}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Player</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>B/T</th>
                  <th className={thClass}>Grad</th>
                  <th className={thClass}>Latest team</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const latest = [...p.roster_entries].sort((a, b) =>
                    (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? ""),
                  )[0];
                  return (
                    <tr key={p.id}>
                      <td className={tdClass}>
                        <Link href={`/players/${p.id}`} className="font-medium hover:underline">
                          {p.last_name}, {p.preferred_name || p.first_name}
                        </Link>
                        <span className="sr-only"> ({playerName(p)})</span>
                      </td>
                      <td className={tdClass} title={p.primary_position ? POSITION_LABEL[p.primary_position] : undefined}>
                        {p.primary_position ?? "–"}
                      </td>
                      <td className={tdClass}>{batsThrows(p)}</td>
                      <td className={`${tdClass} tabular-nums`}>{p.grad_year ?? "–"}</td>
                      <td className={tdClass}>
                        {latest?.team ? (
                          <Link href={`/teams/${latest.team.id}`} className="hover:underline">
                            {latest.team.short_name || latest.team.name}
                            {latest.jersey_number && ` #${latest.jersey_number}`}
                          </Link>
                        ) : (
                          <span className="text-muted/70">Not on a roster</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
