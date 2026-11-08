import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { loadPerformance } from "../../data";
import { loadMyTesting } from "../../testing-data";
import { PerformanceDetail, summarizePerformance } from "../../performance";
import { loadPlayer, positionsOf } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Performance Training · GGG.Cafe" };

export default function TrainingPage({ params }: PageProps<"/players/[playerId]/training">) {
  return (
    <Suspense fallback={<Loading />}>
      <Training params={params} />
    </Suspense>
  );
}

async function Training({ params }: Pick<PageProps<"/players/[playerId]/training">, "params">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const today = todayISO();
  const [performance, testing] = await Promise.all([loadPerformance(supabase, player.id), loadMyTesting(supabase, player.id)]);
  const summary = summarizePerformance(performance, positionsOf(player), today);
  return (
    <SectionShell title="Performance Training" subtitle="Workouts · stretching · drills · testing">
      <PerformanceDetail playerId={player.id} perf={performance} summary={summary} today={today} canEdit={access.canAct} testing={testing} />
    </SectionShell>
  );
}
