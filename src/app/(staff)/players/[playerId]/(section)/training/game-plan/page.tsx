import type { Metadata } from "next";
import Link from "next/link";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Disclosure, EmptyState } from "@/components/ui";
import { addDays, formatDay, todayISO } from "@/lib/dates";
import { GamePlanForm } from "../../../bullpen-client";
import { loadGamePlans } from "../../../pitching-data";
import { firstName, loadPlayer } from "../../../section-data";
import { SectionShell } from "../../section-shell";

export const metadata: Metadata = { title: "Game plans · Performance Training · GGG.Cafe" };

// The pitcher's game plan (Phase 4): before a game her plan, after it a look-back.
const heading = "font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase";

export default async function GamePlanPage({ params }: PageProps<"/players/[playerId]/training/game-plan">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const today = todayISO();
  const { games, plans } = await loadGamePlans(supabase, player.id, addDays(today, -21), addDays(today, 14));
  const planFor = (gameId: string) => plans.find((p) => p.game_id === gameId) ?? null;
  const upcoming = games.filter((g) => g.game_date >= today);
  const past = games.filter((g) => g.game_date < today).reverse();
  const canEdit = access.canAct;

  const card = (g: (typeof games)[number], after: boolean) => {
    const plan = planFor(g.id);
    return (
      <li key={g.id} className="rounded-2xl border border-navy-700 p-4">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-lg font-bold tracking-wide uppercase">vs {g.opponent}</span>
          <span className="text-sm text-muted">{g.game_date === today ? "Today" : formatDay(g.game_date)}</span>
          {plan?.strike_pct != null && <span className="font-mono text-xs text-highlight">{plan.strike_pct}% strikes</span>}
        </p>
        {plan && (
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {(
              [
                ["First pitch", plan.first_pitch],
                ["Out pitch", plan.out_pitch],
                ["Reset", plan.reset],
                ["Watch", plan.watch],
                ["Worked", plan.worked],
                ["Fix", plan.fix],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="inline font-semibold">{k}: </dt>
                  <dd className="inline text-ink/90">{v}</dd>
                </div>
              ))}
          </dl>
        )}
        {canEdit && (
          <div className="mt-3">
            <Disclosure summary={plan ? (after ? "Look back" : "Edit my plan") : after ? "Write my look-back" : "Make my plan"}>
              <GamePlanForm playerId={player.id} gameId={g.id} planDate={g.game_date} opponent={g.opponent} plan={plan} after={after} />
            </Disclosure>
          </div>
        )}
      </li>
    );
  };

  return (
    <SectionShell title="Game plans" subtitle={`${firstName(player)} in the circle`}>
      <div className="flex flex-col gap-8">
        <Link href={`/players/${player.id}/training`} className="-mt-2 self-start text-sm text-pink hover:underline">
          ← Performance Training
        </Link>
        <section className="flex flex-col gap-3">
          <h2 className={heading}>Coming up</h2>
          {upcoming.length ? <ul className="grid gap-3 md:grid-cols-2">{upcoming.map((g) => card(g, false))}</ul> : <EmptyState>No games in the next two weeks.</EmptyState>}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className={heading}>Look back</h2>
          {past.length ? <ul className="grid gap-3 md:grid-cols-2">{past.map((g) => card(g, true))}</ul> : <EmptyState>No games in the last three weeks.</EmptyState>}
        </section>
      </div>
    </SectionShell>
  );
}
