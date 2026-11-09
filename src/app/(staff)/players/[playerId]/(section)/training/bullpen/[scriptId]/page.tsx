import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { isUuid } from "@/lib/softball";
import type { ScriptPitch } from "@/lib/bullpen";
import { BullpenRunner } from "../../../../bullpen-client";
import { loadPlayer } from "../../../../section-data";
import { SectionShell } from "../../../section-shell";

export const metadata: Metadata = { title: "Bullpen · Performance Training · GGG.Cafe" };

export default async function BullpenPage({ params }: PageProps<"/players/[playerId]/training/bullpen/[scriptId]">) {
  const { playerId, scriptId } = await params;
  if (!isUuid(scriptId)) notFound();
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const { data } = await supabase.from("bullpen_scripts").select("id, name, notes, pitches").eq("id", scriptId).maybeSingle();
  if (!data) notFound();
  const script = data as { id: string; name: string; notes: string | null; pitches: ScriptPitch[] };
  return (
    <SectionShell title={script.name} subtitle={`Bullpen · ${script.pitches.length} pitches${script.notes ? ` · ${script.notes}` : ""}`}>
      <BullpenRunner playerId={player.id} scriptId={script.id} pitches={script.pitches} canEdit={access.canAct} backHref={`/players/${player.id}/training`} />
    </SectionShell>
  );
}
