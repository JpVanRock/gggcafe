import type { Metadata } from "next";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { GOAL_METHOD_LABEL } from "@/lib/softball";
import { loadHarada, loadMetricOptions, loadPopReport, loadSmartGoals, possessive } from "../../data";
import { GoalsDetail } from "../../goals";
import { SmartGoalsPanel } from "../../smart";
import { GoalMethodSwitch } from "../../smart-client";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Goals · GGG.Cafe" };

export default async function GoalsPage({ params }: PageProps<"/players/[playerId]/goals">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const method = player.goal_method ?? "harada";
  const [chart, smartGoals, metricOptions, pop] = await Promise.all([
    loadHarada(supabase, player.id),
    loadSmartGoals(supabase, player.id),
    loadMetricOptions(supabase),
    loadPopReport(supabase, player.id),
  ]);
  return (
    <SectionShell title={`${possessive(firstName(player))} Goals`} subtitle={GOAL_METHOD_LABEL[method]}>
      <div className="flex flex-col gap-8">
        <GoalMethodSwitch playerId={player.id} method={method} canEdit={access.canAct} />
        {method === "smart" ? (
          <SmartGoalsPanel playerId={player.id} goals={smartGoals} metrics={pop.metrics} metricOptions={metricOptions} canEdit={access.canAct} />
        ) : (
          <GoalsDetail playerId={player.id} chart={chart} canEdit={access.canAct} />
        )}
      </div>
    </SectionShell>
  );
}
