import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading } from "@/components/ui";
import { sessionBySlug } from "@/lib/mental";
import { SessionRunner } from "../../../../session-client";
import { loadPlayer } from "../../../../section-data";
import { SectionShell } from "../../../section-shell";

export const metadata: Metadata = { title: "Guided session · Mental GP · GGG.Cafe" };

export default function SessionPage({ params }: PageProps<"/players/[playerId]/mental/session/[slug]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Session params={params} />
    </Suspense>
  );
}

async function Session({ params }: Pick<PageProps<"/players/[playerId]/mental/session/[slug]">, "params">) {
  const { playerId, slug } = await params;
  const session = sessionBySlug(slug);
  if (!session) notFound();
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  return (
    <SectionShell title={session.title} subtitle={`Mental GP · ${session.summary}`}>
      <SessionRunner playerId={player.id} session={session} canEdit={access.canAct} backHref={`/players/${player.id}/mental`} />
    </SectionShell>
  );
}
