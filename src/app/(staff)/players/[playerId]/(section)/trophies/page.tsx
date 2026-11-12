import type { Metadata } from "next";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { todayISO } from "@/lib/dates";
import { loadIq, loadPerformance, loadPopReport, possessive } from "../../data";
import { buildPositions } from "../../iq";
import { summarizePerformance } from "../../performance";
import { TrophyRoomDetail, buildTrophyRoom } from "../../trophy-room";
import { firstName, loadPlayer, plateFor, positionsOf } from "../../section-data";
import { SectionShell } from "../section-shell";
import { RewardsNote } from "@/components/legal";

export const metadata: Metadata = { title: "Trophy Room · GGG.Cafe" };

export default async function TrophiesPage({ params }: PageProps<"/players/[playerId]/trophies">) {
  const { playerId } = await params;
  const supabase = await createClient();
  await requirePlayerPage(playerId, "player.trophies");
  const player = await loadPlayer(supabase, playerId);
  const [iq, performance, pop] = await Promise.all([loadIq(supabase, player.id), loadPerformance(supabase, player.id), loadPopReport(supabase, player.id)]);
  const positions = positionsOf(player);
  const training = summarizePerformance(performance, positions, todayISO());
  const room = buildTrophyRoom(iq, buildPositions(iq, positions), training.achievements, plateFor(player, pop));
  return (
    <SectionShell title={`${possessive(firstName(player))} Trophy Room`} subtitle="Trophies · rings · Golden Gloves · MVP badges · achievements" notice={<RewardsNote />}>
      <TrophyRoomDetail room={room} />
    </SectionShell>
  );
}
