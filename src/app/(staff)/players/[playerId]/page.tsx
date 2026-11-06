import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  BATS_LABEL, POSITION_LABEL, THROWS_LABEL, isUuid, playerName, type Player,
} from "@/lib/softball";
import { Card, Disclosure, EmptyState, Loading, PageHeader, tableClass, tdClass, thClass } from "@/components/ui";
import { PlayerForm } from "../player-form";

export const metadata: Metadata = { title: "Player · GGG.Cafe" };

export default function PlayerPage({ params }: PageProps<"/players/[playerId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <PlayerContent params={params} />
    </Suspense>
  );
}

type Rostering = {
  id: string;
  jersey_number: string | null;
  active: boolean;
  team: { id: string; name: string; is_own_team: boolean } | null;
  season: { name: string; start_date: string | null } | null;
};

async function PlayerContent({ params }: Pick<PageProps<"/players/[playerId]">, "params">) {
  const user = await requireStaffPage();
  const { playerId } = await params;
  if (!isUuid(playerId)) notFound();

  const supabase = await createClient();
  const [playerResult, rosterResult] = await Promise.all([
    supabase.from("players").select("*").eq("id", playerId).maybeSingle(),
    supabase
      .from("roster_entries")
      .select("id, jersey_number, active, team:teams(id, name, is_own_team), season:seasons(name, start_date)")
      .eq("player_id", playerId),
  ]);
  const player = playerResult.data as Player | null;
  if (!player) notFound();
  const rosters = ((rosterResult.data ?? []) as unknown as Rostering[]).sort((a, b) =>
    (b.season?.start_date ?? "").localeCompare(a.season?.start_date ?? ""),
  );

  const facts: [string, string][] = [
    ["Position", player.primary_position ? `${player.primary_position} · ${POSITION_LABEL[player.primary_position]}` : "–"],
    ["Also plays", player.secondary_positions.length ? player.secondary_positions.join(", ") : "–"],
    ["Bats", player.bats ? BATS_LABEL[player.bats] : "–"],
    ["Throws", player.throws ? THROWS_LABEL[player.throws] : "–"],
    ["Grad year", player.grad_year ? String(player.grad_year) : "–"],
    ["Slapper", player.is_slapper ? "Yes" : "No"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={playerName(player)}
        description={player.preferred_name ? `${player.first_name} ${player.last_name}` : undefined}
        back={{ href: "/players", label: "Players" }}
      />

      <Card title="Profile">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {player.notes && <p className="mt-4 whitespace-pre-wrap text-sm">{player.notes}</p>}
      </Card>

      <Card title="Teams">
        {rosters.length === 0 ? (
          <EmptyState>Not on any roster yet. Add them from a team&apos;s page.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Season</th>
                  <th className={thClass}>Team</th>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rosters.map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}>{r.season?.name ?? "–"}</td>
                    <td className={tdClass}>
                      {r.team ? (
                        <Link href={`/teams/${r.team.id}`} className="hover:underline">{r.team.name}</Link>
                      ) : "–"}
                    </td>
                    <td className={`${tdClass} tabular-nums`}>{r.jersey_number ?? "–"}</td>
                    <td className={tdClass}>{r.active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canEdit(user.staff.role) && (
        <Disclosure summary="Edit player">
          <PlayerForm player={player} />
        </Disclosure>
      )}
    </div>
  );
}
