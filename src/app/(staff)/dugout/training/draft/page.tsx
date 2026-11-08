import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { EmptyState, Loading, secondaryButtonClass } from "@/components/ui";
import { onTheClock, squadStandings } from "@/lib/training-plan";
import { loadOwnTeams } from "../../data";
import { TeamPicker, pickTeam } from "../../team-picker";
import { TrainingNav } from "../nav";
import { loadSquads, loadTeamRoster } from "../data";
import { draftPick, resetDraft, undoPick } from "../actions";
import { SquadsForm } from "../forms";

export const metadata: Metadata = { title: "Offseason draft · Training · Coaches Dugout · GGG.Cafe" };

// The offseason draft (Phase 2; user: the head coach names the captains): squads
// with a captain each, then a snake draft the head coach records here as the
// captains pick. Squads score the Leaderboard's points; players see the squads
// and their totals on the Leaderboard.
export default function DraftPage({ searchParams }: PageProps<"/dugout/training/draft">) {
  return (
    <Suspense fallback={<Loading />}>
      <Draft searchParams={searchParams} />
    </Suspense>
  );
}

const heading = "font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase";

async function Draft({ searchParams }: Pick<PageProps<"/dugout/training/draft">, "searchParams">) {
  await requireHeadCoachPage();
  const { team: teamParam } = await searchParams;
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
  const [roster, squads, board] = await Promise.all([
    loadTeamRoster(supabase, team.id),
    loadSquads(supabase, team.id),
    supabase.rpc("team_leaderboard", { p_team_id: team.id }),
  ]);
  const players = ((board.data as { players?: { player_id: string; points: number; week_points: number }[] } | null)?.players ?? []).map((p) => ({
    ...p,
    points: Number(p.points),
    week_points: Number(p.week_points),
  }));
  const nameOf = new Map(roster.map((p) => [p.id, `${p.jersey ? `#${p.jersey} ` : ""}${p.name}`]));
  const drafted = new Set(squads.flatMap((s) => s.members));
  const remaining = roster.filter((p) => !drafted.has(p.id));
  const picks = squads.reduce((n, s) => n + s.members.length - 1, 0);
  const clock = squads.length ? squads[onTheClock(squads.length, picks)] : null;
  const standings = squadStandings(squads, players);

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/training/draft" />
      <TrainingNav current="draft" teamId={team.id} head />

      {squads.length === 0 ? (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className={heading}>Offseason draft</h2>
            <p className="mt-1 text-sm text-muted">
              Name the squads and their captains. Captains then take turns picking teammates (snake order: the last pick of a round picks
              first in the next), and you record each pick here. Squads score every point their players earn on the Leaderboard.
            </p>
          </div>
          {roster.length < 4 ? <EmptyState>The draft needs at least four players on the current roster.</EmptyState> : <SquadsForm teamId={team.id} roster={roster} />}
        </section>
      ) : (
        <>
          {remaining.length > 0 && clock ? (
            <section className="flex flex-col gap-4 rounded-2xl border-2 border-neon p-5">
              <p className="font-mono text-xs tracking-[0.3em] text-pink-soft uppercase">On the clock · pick {picks + 1}</p>
              <p className="font-display text-4xl leading-none font-bold tracking-tight text-highlight uppercase">{clock.name}</p>
              <p className="text-sm text-muted">Captain {nameOf.get(clock.captain_id) ?? ""}. Tap the player she picks.</p>
              <ul className="flex flex-wrap gap-2">
                {remaining.map((p) => (
                  <li key={p.id}>
                    <form action={draftPick}>
                      <input type="hidden" name="team_id" value={team.id} />
                      <input type="hidden" name="player_id" value={p.id} />
                      <button type="submit" className="rounded-full border border-navy-600 px-3 py-1.5 text-sm font-semibold transition hover:border-pink hover:bg-pink hover:text-on-accent">
                        {p.jersey && <span className="mr-1 font-display tabular-nums">#{p.jersey}</span>}
                        {p.name}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="rounded-xl border border-neon/60 bg-neon/10 p-4 text-sm font-semibold">The draft is done. Every player on the roster has a squad.</p>
          )}

          <section className="flex flex-col gap-3">
            <h2 className={heading}>Squads</h2>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {standings.map((s) => (
                <li key={s.id} className={`rounded-2xl border p-4 ${clock?.id === s.id && remaining.length ? "border-neon" : "border-navy-600"}`}>
                  <p className="font-display text-xl font-bold tracking-wide uppercase">{s.name}</p>
                  <p className="font-mono text-xs text-muted">
                    {s.points} pts · {s.weekPoints} this week
                  </p>
                  <ol className="mt-3 flex flex-col gap-1 text-sm">
                    {s.members.map((id, i) => (
                      <li key={id} className="flex gap-2">
                        <span className="w-4 text-right font-mono text-xs text-muted">{i === 0 ? "C" : i}</span>
                        <span>{nameOf.get(id) ?? "Off the roster"}</span>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            {picks > 0 && (
              <form action={undoPick}>
                <input type="hidden" name="team_id" value={team.id} />
                <button type="submit" className={secondaryButtonClass}>
                  Undo last pick
                </button>
              </form>
            )}
            <form action={resetDraft} className="ml-auto">
              <input type="hidden" name="team_id" value={team.id} />
              <ConfirmSubmit message="Start the draft over? Every squad and pick is removed (points stay with the players)." className="text-xs text-danger hover:underline">
                Start over
              </ConfirmSubmit>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
