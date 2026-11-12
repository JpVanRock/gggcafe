import type { Metadata } from "next";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { todayISO } from "@/lib/dates";
import { loadPerformance } from "../../data";
import { loadMyTesting } from "../../testing-data";
import { loadBullpens } from "../../pitching-data";
import { PitchingSection } from "../../pitching";
import { PerformanceDetail, summarizePerformance } from "../../performance";
import { loadPlayer, positionsOf } from "../../section-data";
import { SectionShell } from "../section-shell";
import { SafetyNote } from "@/components/legal";

export const metadata: Metadata = { title: "Performance Training · GGG.Cafe" };

export default async function TrainingPage({ params }: PageProps<"/players/[playerId]/training">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId, "player.training");
  const player = await loadPlayer(supabase, playerId);
  const today = todayISO();
  const positions = positionsOf(player);
  const pitcher = positions.includes("P");
  const [performance, testing, bullpens] = await Promise.all([
    loadPerformance(supabase, player.id),
    loadMyTesting(supabase, player.id),
    pitcher ? loadBullpens(supabase, player.id) : Promise.resolve(null),
  ]);
  const summary = summarizePerformance(performance, positions, today);
  return (
    <SectionShell title="Performance Training" subtitle="Workouts · stretching · drills · testing" notice={<SafetyNote audience="player" />}>
      <div className="flex flex-col gap-10">
        {bullpens && <PitchingSection playerId={player.id} scripts={bullpens.scripts} sessions={bullpens.sessions} canEdit={access.canAct} />}
        <PerformanceDetail playerId={player.id} perf={performance} summary={summary} today={today} canEdit={access.canAct} testing={testing} />
      </div>
    </SectionShell>
  );
}
