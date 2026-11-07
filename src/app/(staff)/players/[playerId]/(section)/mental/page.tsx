import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading } from "@/components/ui";
import { loadMentalPlan } from "../../data";
import { MentalDetail } from "../../mental";
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
  const plan = await loadMentalPlan(supabase, player.id);
  return (
    <SectionShell title="Mental GP" subtitle="Mental Game Plan">
      <MentalDetail playerId={player.id} plan={plan} canEdit={access.canAct} />
    </SectionShell>
  );
}
