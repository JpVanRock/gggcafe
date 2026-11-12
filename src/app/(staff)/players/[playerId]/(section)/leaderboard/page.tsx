import type { Metadata } from "next";
import Link from "next/link";
import { requirePlayerPage } from "@/lib/auth";
import { addDays, formatDay, formatLongDate } from "@/lib/dates";
import {
  POINTS, POTW_COOLDOWN_WEEKS, POTW_MIN, currentRound, latestWinner, rankRows, sessionLabel, weekRace, weekRange,
} from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";
import { SpeedStripes } from "@/components/athletic";
import { squadStandings, type SquadRow } from "@/lib/training-plan";
import { StatTerm } from "@/components/stat-term";
import { EmptyState, buttonClass, tableClass, tdClass, thClass, TableScroll } from "@/components/ui";
import { loadTeamDugout } from "../../data";
import { loadLeaderboard, loadTeamSessions } from "../../leaderboard-data";
import { RemoveTeamSession } from "../../leaderboard-client";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";
import { RewardsNote } from "@/components/legal";
import { pickTeam } from "../../../../dugout/team-picker";

export const metadata: Metadata = { title: "Leaderboard · GGG.Cafe" };

const heading = "mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

/** The board's rallying cry (user, 2026-11-08: "This is meant to be fun"). */
function BestVersion() {
  return (
    <header className="text-center">
      <p className="flex items-center justify-center gap-3 font-mono text-xs tracking-[0.35em] text-pink-soft uppercase">
        <SpeedStripes className="h-3 w-9 text-link" />
        Offseason Training
        <SpeedStripes className="h-3 w-9 -scale-x-100 text-link" />
      </p>
      <h2 className="mt-3 bg-linear-to-r from-highlight via-highlight to-pink bg-clip-text pb-1 font-display text-4xl leading-none font-black tracking-tight text-transparent uppercase italic sm:text-6xl">
        Be the Best Version of You
      </h2>
    </header>
  );
}
const STATUS_LABEL = { eligible: "In the running", "named-this-round": "Named this round" } as const;

export default async function LeaderboardPage({ params, searchParams }: PageProps<"/players/[playerId]/leaderboard">) {
  const { playerId } = await params;
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId, "player.leaderboard");
  const player = await loadPlayer(supabase, playerId);
  const name = firstName(player);
  const teams = (await loadTeamDugout(supabase, player.id)).map((t) => t.team);
  const team = pickTeam(teams, teamParam);
  if (!team) {
    return (
      <SectionShell title="Leaderboard" subtitle="Offseason Training">
        <EmptyState>{name} isn&apos;t on one of our teams right now, so there&apos;s no leaderboard to show.</EmptyState>
      </SectionShell>
    );
  }
  const board = await loadLeaderboard(supabase, team.id);
  const base = `/players/${player.id}`;
  const teamPills = teams.length > 1 && (
    <nav aria-label="Team" className="flex flex-wrap gap-1.5">
      {teams.map((t) => (
        <Link
          key={t.id}
          href={`${base}/leaderboard?team=${t.id}`}
          aria-current={t.id === team.id ? "page" : undefined}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            t.id === team.id ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
          }`}
        >
          {t.name}
        </Link>
      ))}
    </nav>
  );

  if (!board?.offseason) {
    return (
      <SectionShell title="Leaderboard" subtitle={`${team.name} · Offseason Training`}>
        <div className="flex flex-col gap-6">
          {teamPills}
          <BestVersion />
          <EmptyState>
            {board ? "Offseason Training hasn't started yet. Your coach sets the dates, and the leaderboard opens then." : "You can only see your own team's leaderboard."}
          </EmptyState>
        </div>
      </SectionShell>
    );
  }

  const rows = rankRows(board.players);
  const weekStart = board.week_start ?? board.today;
  const race = weekRace(board.players, board.weeks, weekStart);
  const winner = latestWinner(board.weeks);
  const winnerRow = winner && board.players.find((p) => p.player_id === winner.player_id);
  const { round, named } = currentRound(board.players, board.weeks);
  const off = board.offseason;
  const span = off.ends_on ? `${formatDay(off.starts_on)} – ${formatLongDate(off.ends_on)}` : `Since ${formatLongDate(off.starts_on)}`;
  // Coaches' session list, the draft squads and the BP board don't depend on each other: load them together.
  const [recent, squadRows, bpRows] = await Promise.all([
    access.canManage ? loadTeamSessions(supabase, board.players.map((p) => p.player_id), addDays(board.today, -14)) : Promise.resolve([]),
    supabase.rpc("team_squads", { p_team_id: team.id }),
    supabase.rpc("team_bp_leaders", { p_team_id: team.id }),
  ]);
  // the offseason draft: squads score their players' points
  const squads = squadStandings((squadRows.data ?? []) as SquadRow[], board.players);
  const mySquad = squads.find((sq) => sq.members.includes(player.id));
  // BP production (Phase 9): the top five hitters with 20+ graded swings
  const bpLeaders = (bpRows.data ?? []) as {
    player_id: string;
    first_name: string;
    last_name: string;
    jersey_number: string | null;
    swings: number;
    production: number;
  }[];
  const nameOf = (id: string) => {
    const r = board.players.find((p) => p.player_id === id);
    return r ? `${r.first_name} ${r.last_name}` : "a player";
  };

  return (
    <SectionShell title="Leaderboard" subtitle={`${team.name} · Offseason Training · ${span}`} notice={<RewardsNote />}>
      <div className="flex flex-col gap-10">
        {teamPills}

        <BestVersion />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Player of the Week */}
          <section className="relative overflow-hidden rounded-2xl border-2 border-neon bg-linear-to-br from-navy-950 to-navy-900 p-5 sm:p-6">
            <p className="flex items-center gap-3 font-mono text-xs tracking-[0.3em] text-pink-soft uppercase">
              <SpeedStripes className="h-3 w-9 text-link" />
              Player of the Week
            </p>
            {winner && winnerRow ? (
              <>
                <p className="mt-3 font-display text-4xl leading-none font-bold tracking-tight text-highlight uppercase sm:text-5xl">
                  {winnerRow.first_name} <span className="text-ink">{winnerRow.last_name}</span>
                </p>
                <p className="mt-2 font-mono text-sm text-muted">
                  {winnerRow.jersey_number && `#${winnerRow.jersey_number} · `}
                  {weekRange(winner.week_start)} · {winner.points} points
                </p>
              </>
            ) : (
              <p className="mt-3 text-lg font-semibold">
                The first Player of the Week is named after the first full week. Most points that week wins ({POTW_MIN} or more).
              </p>
            )}
            <div className="mt-5">
              <p className="font-mono text-2xs tracking-wider text-muted uppercase">
                Round {round} · {named.size} of {board.players.length} named
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {board.players
                  .slice()
                  .sort((a, b) => a.last_name.localeCompare(b.last_name))
                  .map((p) => (
                    <li
                      key={p.player_id}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        named.has(p.player_id) ? "border-neon bg-neon text-on-accent" : "border-navy-500 text-muted"
                      }`}
                    >
                      {p.first_name} {p.last_name.slice(0, 1)}.
                    </li>
                  ))}
              </ul>
            </div>
          </section>

          {/* + Activity */}
          <Link
            href={`${base}/log`}
            className="flex flex-col justify-between gap-4 rounded-2xl border-2 border-pink bg-pink/5 p-5 transition hover:bg-pink/10 sm:p-6"
          >
            <span>
              <span className="block font-display text-3xl font-bold tracking-wide text-ink uppercase">+ Activity</span>
              <span className="mt-1 block text-sm text-muted">Log a training session, a workout or a private lesson.</span>
            </span>
            <span className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tracking-wider text-muted uppercase">
              <span>
                Training <b className="text-highlight">+{POINTS.training}</b>
              </span>
              <span>
                Workout <b className="text-highlight">+{POINTS.workout}</b>
              </span>
              <span>
                Private lesson <b className="text-highlight">+{POINTS.lesson}</b>
              </span>
              <span>
                Each unlock <b className="text-highlight">+{POINTS.unlock}</b>
              </span>
            </span>
          </Link>
        </div>

        {/* the offseason draft */}
        {squads.length > 0 && (
          <section>
            <h2 className={heading}>Squads</h2>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {squads.map((sq, i) => (
                <li
                  key={sq.id}
                  className={`relative overflow-hidden rounded-2xl border p-4 ${sq.id === mySquad?.id ? "border-2 border-pink" : i === 0 ? "border-neon" : "border-navy-600"}`}
                >
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-2xl font-bold tracking-wide uppercase">{sq.name}</span>
                    <span className="font-display text-3xl font-black text-highlight tabular-nums">{sq.points}</span>
                  </p>
                  <p className="font-mono text-2xs tracking-wider text-muted uppercase">
                    {i === 0 ? "Leading · " : ""}+{sq.weekPoints} this week{sq.id === mySquad?.id ? " · your squad" : ""}
                  </p>
                  <p className="mt-3 text-sm text-ink/90">
                    {sq.members
                      .map((id) => board.players.find((p) => p.player_id === id))
                      .filter((p): p is NonNullable<typeof p> => Boolean(p))
                      .map((p) => `${p.first_name}${p.player_id === sq.captain_id ? " (C)" : ""}`)
                      .join(", ")}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* this week's race */}
        <section>
          <h2 className={heading}>This week · {weekRange(weekStart)}</h2>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {race.slice(0, 6).map((r, i) => (
              <li
                key={r.player_id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${r.player_id === player.id ? "border-pink" : "border-navy-700"} ${
                  r.status === "eligible" ? "" : "border-dashed"
                }`}
              >
                <span className="w-6 font-display text-lg font-bold text-highlight tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {r.first_name} {r.last_name}
                  </span>
                  <span className="block font-mono text-2xs tracking-wider text-muted uppercase">
                    {r.status === "cooldown" ? `Back in the running ${formatDay(r.until!)}` : STATUS_LABEL[r.status]}
                  </span>
                </span>
                <span className="font-display text-xl font-bold tabular-nums">{r.week_points}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">
            Most points Monday to Sunday wins ({POTW_MIN} or more), named the Tuesday after. Each player is named once every {POTW_COOLDOWN_WEEKS} weeks at
            most, and nobody wins twice until every teammate has won once.
          </p>
        </section>

        {/* standings */}
        <section>
          <h2 className={heading}>Standings</h2>
          <TableScroll label="Standings">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Rank</th>
                  <th className={thClass}>Player</th>
                  <th className={`${thClass} text-right`}>Training</th>
                  <th className={`${thClass} text-right`}>Workouts</th>
                  <th className={`${thClass} text-right`}>Lessons</th>
                  <th className={`${thClass} text-right`}>Unlocks</th>
                  <th className={`${thClass} text-right`} title="Total points this offseason">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.player_id} className={r.player_id === player.id ? "bg-pink/10" : ""}>
                    <td className={`${tdClass} font-display text-lg font-bold text-highlight tabular-nums`}>{r.rank}</td>
                    <td className={tdClass}>
                      <span className="font-semibold">
                        {r.first_name} {r.last_name}
                      </span>
                      {r.jersey_number && <span className="ml-2 font-mono text-xs text-muted">#{r.jersey_number}</span>}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{r.training}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{r.workouts}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{r.lessons}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{r.unlocks}</td>
                    <td className={`${tdClass} text-right font-display text-xl font-bold text-highlight tabular-nums`}>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </section>

        {bpLeaders.length > 0 && (
          <section>
            <h2 className={heading}>
              BP production · <StatTerm k="PROD" />
            </h2>
            <ol className="grid gap-1.5 sm:grid-cols-2">
              {bpLeaders.map((r, i) => (
                <li
                  key={r.player_id}
                  className={`flex items-baseline justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${r.player_id === player.id ? "border-pink" : "border-navy-700"}`}
                >
                  <span>
                    <span className="mr-2 font-display font-bold text-pink-soft tabular-nums">{i + 1}</span>
                    <span className="font-semibold">
                      {r.first_name} {r.last_name}
                    </span>
                    {r.jersey_number && <span className="ml-1.5 font-mono text-xs text-muted">#{r.jersey_number}</span>}
                  </span>
                  <span className="font-display tabular-nums">
                    <span className="text-lg font-bold text-highlight">{Number(r.production).toFixed(2)}</span>
                    <span className="ml-1.5 text-xs text-muted">{r.swings} swings</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {board.weeks.length > 0 && (
          <section>
            <h2 className={heading}>Players of the Week</h2>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {board.weeks.map((w) => (
                <li key={w.week_start} className="flex items-baseline justify-between gap-3 rounded-lg border border-navy-700 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-muted">{weekRange(w.week_start)}</span>
                  {w.player_id ? (
                    <span className="font-semibold">
                      {w.first_name} {w.last_name} <span className="font-display text-muted tabular-nums">· {w.points}</span>
                    </span>
                  ) : (
                    <span className="text-muted">No one reached {POTW_MIN} points</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {access.canManage && (
          <section className="flex flex-col gap-5 rounded-xl border border-navy-700 p-4">
            <div>
              <p className={heading}>Sessions logged in the last two weeks</p>
              {recent.length === 0 ? (
                <p className="text-sm text-muted">None yet.</p>
              ) : (
                <ul className="divide-y divide-navy-700 rounded-lg border border-navy-700">
                  {recent.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                      <span className="w-24 shrink-0 font-display text-muted tabular-nums">{formatDay(s.logged_on)}</span>
                      <span className="font-semibold">{nameOf(s.player_id)}</span>
                      <span>{sessionLabel(s.kind)}</span>
                      {s.note && <span className="min-w-0 flex-1 truncate text-muted">{s.note}</span>}
                      <span className="ml-auto">
                        <RemoveTeamSession id={s.id} who={nameOf(s.player_id)} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <Link href={`${base}/log`} className={`${buttonClass} self-start`}>
          + Activity
        </Link>
      </div>
    </SectionShell>
  );
}
