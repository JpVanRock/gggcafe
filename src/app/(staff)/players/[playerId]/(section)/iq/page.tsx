import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading } from "@/components/ui";
import { loadIq, loadPopReport } from "../../data";
import { IqDetail, buildLibrary, buildPositions, buildQuizzes, buildTracks } from "../../iq";
import { loadPlayer, plateFor, positionsOf } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Softball IQ · GGG.Cafe" };

export default function IqPage({ params }: PageProps<"/players/[playerId]/iq">) {
  return (
    <Suspense fallback={<Loading />}>
      <Iq params={params} />
    </Suspense>
  );
}

async function Iq({ params }: Pick<PageProps<"/players/[playerId]/iq">, "params">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const [iq, pop] = await Promise.all([loadIq(supabase, player.id), loadPopReport(supabase, player.id)]);
  const positions = positionsOf(player);
  return (
    <SectionShell title="Softball IQ" subtitle="Defense IQ · Baserunning IQ · Position IQ · Extra Credit">
      <IqDetail
        playerId={player.id}
        quizzes={buildQuizzes(iq, positions)}
        tracks={buildTracks(iq)}
        positions={buildPositions(iq, positions)}
        library={buildLibrary(iq)}
        plate={plateFor(player, pop)}
        iq={iq}
        canEdit={access.canAct}
        canManage={access.canManage}
      />
    </SectionShell>
  );
}
