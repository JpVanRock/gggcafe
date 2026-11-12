import type { Metadata } from "next";
import Link from "next/link";
import { requirePlayerPage } from "@/lib/auth";
import { formatDay, todayISO } from "@/lib/dates";
import { LOG_DAYS_BACK, POINTS, rankRows, sessionLabel } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, eyebrowClass } from "@/components/ui";
import { loadTeamDugout } from "../../data";
import { loadLeaderboard, loadMySessions } from "../../leaderboard-data";
import { LogSessionForm, RemoveSession } from "../../leaderboard-client";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "+ Activity · GGG.Cafe" };

const heading = "mb-3 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

export default async function LogPage({ params }: PageProps<"/players/[playerId]/log">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId, "player.activity");
  const player = await loadPlayer(supabase, playerId);
  const name = firstName(player);
  const today = todayISO();
  const [sessions, teams] = await Promise.all([loadMySessions(supabase, player.id), loadTeamDugout(supabase, player.id)]);
  // where she stands on her (first) team's board, if its offseason is on
  const board = teams[0] ? await loadLeaderboard(supabase, teams[0].team.id) : null;
  const me = board?.offseason ? rankRows(board.players).find((r) => r.player_id === player.id) : undefined;

  return (
    <SectionShell title="+ Activity" subtitle={`${name} · Offseason Training`}>
      <div className="flex flex-col gap-10">
        {me && (
          <Link
            href={`/players/${player.id}/leaderboard`}
            className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl border border-pink/60 bg-pink/5 px-5 py-4 transition hover:bg-pink/10"
          >
            <span>
              <span className={`${eyebrowClass} block`}>Leaderboard</span>
              <span className="font-display text-3xl font-bold text-highlight tabular-nums">#{me.rank}</span>
              <span className="ml-2 text-sm text-muted">of {board!.players.length}</span>
            </span>
            <span>
              <span className={`${eyebrowClass} block`}>Offseason points</span>
              <span className="font-display text-3xl font-bold tabular-nums">{me.points}</span>
            </span>
            <span>
              <span className={`${eyebrowClass} block`}>This week</span>
              <span className="font-display text-3xl font-bold tabular-nums">{me.week_points}</span>
            </span>
            <span className="ml-auto text-sm text-link">Leaderboard →</span>
          </Link>
        )}

        {access.canAct ? (
          <LogSessionForm playerId={player.id} today={today} daysBack={LOG_DAYS_BACK} />
        ) : (
          <EmptyState>Only {name} and her coaches can log sessions.</EmptyState>
        )}

        <p className="max-w-3xl text-sm text-muted">
          Training routines you check off in This Week in Softball count on their own, so don&apos;t log them twice. Unlocks on the site (rings, Golden
          Gloves, badges, trophies, achievements) are worth {POINTS.unlock} points each, and they count automatically. You can log sessions from the
          last {LOG_DAYS_BACK} days, up to four a day.
        </p>

        <section>
          <h2 className={heading}>Your sessions</h2>
          {sessions.length === 0 ? (
            <EmptyState>Nothing logged yet. Your first session goes here.</EmptyState>
          ) : (
            <ul className="divide-y divide-navy-700 rounded-xl border border-navy-700">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <span className="w-24 shrink-0 font-display text-sm text-muted tabular-nums">{formatDay(s.logged_on)}</span>
                  <span className="font-semibold">{sessionLabel(s.kind)}</span>
                  <span className="font-display font-bold text-highlight tabular-nums">+{POINTS[s.kind as keyof typeof POINTS] ?? 0}</span>
                  {s.note && <span className="min-w-0 flex-1 truncate text-sm text-muted">{s.note}</span>}
                  {access.canAct && (
                    <span className="ml-auto">
                      <RemoveSession playerId={player.id} id={s.id} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SectionShell>
  );
}
