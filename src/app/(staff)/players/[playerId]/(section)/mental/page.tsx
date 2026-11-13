import type { Metadata } from "next";
import Link from "next/link";
import { getPlayerFeaturesOff, requirePlayerPage } from "@/lib/auth";
import { pillOutlineClass } from "@/components/ui";
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
  const [plan, tools, off] = await Promise.all([
    loadMentalPlan(supabase, player.id),
    loadMentalTools(supabase, player.id, today),
    access.user.staff ? Promise.resolve(new Set<string>()) : getPlayerFeaturesOff(player.id),
  ]);
  // My Journal (user, 2026-11-12): a pill here, for her and her parents (coaches don't read it)
  const journal = (access.isSelf || access.isParent) && !off.has("player.journal");
  return (
    <SectionShell title="Mental GP" subtitle="Mental Game Plan">
      <div className="flex flex-col gap-10">
        {journal && (
          <nav aria-label="Mental GP" className="-mb-4 flex flex-wrap gap-2">
            <Link href={`/players/${player.id}/mental/my-journal`} className={pillOutlineClass}>
              My Journal
            </Link>
          </nav>
        )}
        <MentalDetail playerId={player.id} plan={plan} canEdit={access.canAct} />
        <MentalTools playerId={player.id} plan={plan} {...tools} today={today} canEdit={access.canAct} />
      </div>
    </SectionShell>
  );
}
