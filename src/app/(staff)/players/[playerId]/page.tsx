import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isISODate, todayISO, weekStart } from "@/lib/dates";
import { isUuid, type Player } from "@/lib/softball";
import { Loading } from "@/components/ui";
import {
  loadActivities, loadHarada, loadIq, loadMentalPlan, loadMetricOptions, loadPerformance, loadPopReport, loadSmartGoals,
  loadTwisWeek,
} from "./data";
import { PlayerMenu } from "./player-menu";

export const metadata: Metadata = { title: "Player · GGG.Cafe" };

export default function PlayerDashboardPage({ params, searchParams }: PageProps<"/players/[playerId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <PlayerDashboard params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlayerDashboard({ params, searchParams }: Pick<PageProps<"/players/[playerId]">, "params" | "searchParams">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { playerId } = await params;
  const { week } = await searchParams;
  if (!isUuid(playerId)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
  const player = data as Player | null;
  if (!player) notFound();

  const today = todayISO();
  const monday = weekStart(isISODate(week) ? week : today);
  const [twis, chart, mental, pop, activities, smartGoals, metricOptions, performance, iq] = await Promise.all([
    loadTwisWeek(supabase, player.id, monday),
    loadHarada(supabase, player.id),
    loadMentalPlan(supabase, player.id),
    loadPopReport(supabase, player.id),
    loadActivities(supabase, player.id, monday, "9999-12-31"),
    loadSmartGoals(supabase, player.id),
    loadMetricOptions(supabase),
    loadPerformance(supabase, player.id),
    loadIq(supabase, player.id),
  ]);

  return (
    <PlayerMenu
      player={player}
      twis={twis}
      chart={chart}
      mental={mental}
      pop={pop}
      activities={activities}
      smartGoals={smartGoals}
      metricOptions={metricOptions}
      performance={performance}
      iq={iq}
      today={today}
      canEdit={editor}
    />
  );
}
