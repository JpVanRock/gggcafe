import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isISODate, todayISO, weekStart } from "@/lib/dates";
import { isUuid, type Player } from "@/lib/softball";
import { Loading } from "@/components/ui";
import {
  loadActivities, loadHarada, loadIq, loadMentalPlan, loadMetricOptions, loadPerformance, loadPopReport, loadSmartGoals,
  loadMovementAndHitting, loadTeamDugout, loadTwisWeek,
} from "./data";
import { PlayerMenu } from "./player-menu";
import { signedPhotoUrls } from "@/lib/player-photos";
import type { MoveSeason, MoveTeam } from "../move-form";

export const metadata: Metadata = { title: "Player · GGG.Cafe" };

export default function PlayerDashboardPage({ params, searchParams }: PageProps<"/players/[playerId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <PlayerDashboard params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlayerDashboard({ params, searchParams }: Pick<PageProps<"/players/[playerId]">, "params" | "searchParams">) {
  const { playerId } = await params;
  const { week } = await searchParams;
  if (!isUuid(playerId)) notFound();
  // staff, or the player herself with an approved claim for this season
  const access = await requirePlayerPage(playerId);

  const supabase = await createClient();
  const { data } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
  const player = data as Player | null;
  if (!player) notFound();

  const today = todayISO();
  const monday = weekStart(isISODate(week) ? week : today);
  const [twis, chart, mental, pop, activities, smartGoals, metricOptions, performance, iq, dugout, styles] = await Promise.all([
    loadTwisWeek(supabase, player.id, monday),
    loadHarada(supabase, player.id),
    loadMentalPlan(supabase, player.id),
    loadPopReport(supabase, player.id),
    loadActivities(supabase, player.id, monday, "9999-12-31"),
    loadSmartGoals(supabase, player.id),
    loadMetricOptions(supabase),
    loadPerformance(supabase, player.id),
    loadIq(supabase, player.id),
    loadTeamDugout(supabase, player.id),
    loadMovementAndHitting(supabase, player.id),
  ]);
  // Coaches can move her to another team.
  const move = access.canManage
    ? await Promise.all([
        supabase.from("teams").select("id, name, organization, age_group, is_own_team").order("is_own_team", { ascending: false }).order("name"),
        supabase.from("seasons").select("id, name").order("start_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
      ]).then(([t, s]) => ({ teams: (t.data ?? []) as MoveTeam[], seasons: (s.data ?? []) as MoveSeason[] }))
    : null;
  const photoUrl = player.photo_path ? ((await signedPhotoUrls(supabase, [player.photo_path])).get(player.photo_path) ?? null) : null;

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
      dugout={dugout}
      photoUrl={photoUrl}
      move={move}
      styles={styles}
      today={today}
      canEdit={access.canAct}
      canManage={access.canManage}
      isSelf={access.isSelf}
    />
  );
}
