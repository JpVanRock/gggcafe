import type { Metadata } from "next";
import Link from "next/link";
import { canEdit, requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Disclosure, EmptyState, tableClass, tdClass, thClass } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import { BASE_RUNNING_LABEL, HITTING_TYPE_LABEL, percent, rate } from "@/lib/gameday";
import { loadGamedayRoster } from "@/lib/gameday-data";
import { seasonOrCurrent } from "@/lib/roster";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";
import { CardsForm, NewLineupForm } from "./forms";
import { GamedayNav } from "./nav";
import { StatTerm } from "@/components/stat-term";

export const metadata: Metadata = { title: "GameDay · Coaches Dugout · GGG.Cafe" };

type LineupRow = { id: string; game_date: string; opponent: string | null; title: string | null; status: "draft" | "final"; shared_at: string | null; batting_order: string[] };

export default async function GamedayPage({ searchParams }: PageProps<"/dugout/gameday">) {
  const user = await requireHeadCoachPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const today = todayISO();
  const seasonId = await seasonOrCurrent(supabase, team.id, null);
  const [roster, lineupsResult, gamesResult, seasonResult] = await Promise.all([
    seasonId ? loadGamedayRoster(supabase, team.id, seasonId) : Promise.resolve([]),
    supabase
      .from("gameday_lineups")
      .select("id, game_date, opponent, title, status, shared_at, batting_order")
      .eq("team_id", team.id)
      .order("game_date", { ascending: false }),
    supabase
      .from("games")
      .select("game_date, home_team_id, home:teams!home_team_id(name), away:teams!away_team_id(name)")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .gte("game_date", today)
      .order("game_date")
      .limit(10),
    seasonId ? supabase.from("seasons").select("name").eq("id", seasonId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const lineups = (lineupsResult.data ?? []) as LineupRow[];
  const games = ((gamesResult.data ?? []) as { game_date: string; home_team_id: string; home: { name: string } | null; away: { name: string } | null }[]).map(
    (g) => ({ date: g.game_date, opponent: (g.home_team_id === team.id ? g.away?.name : g.home?.name) ?? "" }),
  );

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/gameday" />
      <GamedayNav current="lineups" teamId={team.id} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">Game lineups</h2>
          <p className="text-sm text-muted">Batting order, defensive rotations and pitching plan. Print or share each one.</p>
        </div>
        {editor && seasonId && (
          <Disclosure summary="New lineup" open={lineups.length === 0}>
            <NewLineupForm teamId={team.id} seasonId={seasonId} today={today} games={games} />
          </Disclosure>
        )}
        {lineups.length === 0 ? (
          <EmptyState>No lineups yet.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {lineups.map((l) => {
              const [weekday, ...rest] = formatDay(l.game_date).split(", ");
              return (
                <li key={l.id}>
                  <Link
                    href={`/dugout/gameday/${l.id}`}
                    className="flex items-center gap-4 rounded-xl border border-navy-700 bg-navy-900/70 p-4 transition hover:border-pink hover:bg-navy-800"
                  >
                    <div className="w-16 shrink-0 text-center">
                      <p className="font-mono text-xs tracking-widest text-pink-soft uppercase">{weekday}</p>
                      <p className="font-display text-lg leading-tight font-bold text-highlight tabular-nums">{rest.join(", ")}</p>
                    </div>
                    <div className="min-w-0 flex-1 border-l border-navy-700 pl-4">
                      <p className="truncate font-semibold">{l.opponent ? `vs ${l.opponent}` : "Lineup"}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {[l.title, `${l.batting_order.length} in the order`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${
                        l.status === "final" ? "bg-neon text-on-accent" : "border border-pink text-pink-soft"
                      }`}
                    >
                      {l.status === "draft" ? "Draft" : l.shared_at ? "Final · Shared" : "Final"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Card title={`Player cards${seasonResult.data?.name ? ` · ${seasonResult.data.name}` : ""}`}>
        {!seasonId || roster.length === 0 ? (
          <EmptyState>
            No roster yet. Build it with{" "}
            <Link href={`/teams/${team.id}/intake`} className="text-pink hover:underline">
              Player intake
            </Link>
            .
          </EmptyState>
        ) : editor ? (
          <CardsForm teamId={team.id} seasonId={seasonId} players={roster} />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Player</th>
                  <th className={thClass}>Hitting type</th>
                  <th className={thClass}>Base running</th>
                  <th className={thClass}>
                    <StatTerm k="AVG" />
                  </th>
                  <th className={thClass}>
                    <StatTerm k="OBP" />
                  </th>
                  <th className={thClass}>
                    <StatTerm k="K%" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => (
                  <tr key={p.id}>
                    <td className={tdClass}>{p.short}</td>
                    <td className={tdClass}>{p.hitting_type ? HITTING_TYPE_LABEL[p.hitting_type] : "–"}</td>
                    <td className={tdClass}>{p.base_running ? BASE_RUNNING_LABEL[p.base_running] : "–"}</td>
                    <td className={`${tdClass} tabular-nums`}>{rate(p.avg)}</td>
                    <td className={`${tdClass} tabular-nums`}>{rate(p.obp)}</td>
                    <td className={`${tdClass} tabular-nums`}>{percent(p.k_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
