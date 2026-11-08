import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { loadMentalPlan } from "../../data";
import { MentalDetail } from "../../mental";
import { MentalTools } from "../../mental-game";
import { loadMentalTools } from "../../mental-data";
import { loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Mental GP · GGG.Cafe" };

export default function MentalPage({ params }: PageProps<"/players/[playerId]/mental">) {
  return (
    <Suspense fallback={<Loading />}>
      <Mental params={params} />
    </Suspense>
  );
}

async function Mental({ params }: Pick<PageProps<"/players/[playerId]/mental">, "params">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
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
