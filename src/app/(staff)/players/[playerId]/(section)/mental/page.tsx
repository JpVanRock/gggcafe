import type { Metadata } from "next";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { todayISO } from "@/lib/dates";
import { loadMentalPlan } from "../../data";
import { MentalDetail } from "../../mental";
import { MentalTools } from "../../mental-game";
import { loadMentalTools } from "../../mental-data";
import { loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Mental GP · GGG.Cafe" };

export default async function MentalPage({ params }: PageProps<"/players/[playerId]/mental">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId, "player.mental");
  const player = await loadPlayer(supabase, playerId);
  const today = todayISO();
  const [plan, tools] = await Promise.all([loadMentalPlan(supabase, player.id), loadMentalTools(supabase, player.id, today)]);
  return (
    <SectionShell title="Mental GP" subtitle="Mental Game Plan">
      <div className="flex flex-col gap-10">
        <MentalDetail playerId={player.id} plan={plan} canEdit={access.canAct} />
        <MentalTools playerId={player.id} plan={plan} {...tools} today={today} canEdit={access.canAct} />
      </div>
    </SectionShell>
  );
}
