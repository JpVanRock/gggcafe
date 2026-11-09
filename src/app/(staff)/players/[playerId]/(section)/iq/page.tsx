import type { Metadata } from "next";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

import { loadTeamPlaybook } from "../../playbook-data";
import { loadIq, loadPopReport } from "../../data";
import { IqDetail, buildBadgeTracks, buildLibrary, buildPositions, buildQuizzes, buildTracks } from "../../iq";
import { loadPlayer, plateFor, positionsOf } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Softball IQ · GGG.Cafe" };

export default async function IqPage({ params }: PageProps<"/players/[playerId]/iq">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const [iq, pop, team] = await Promise.all([loadIq(supabase, player.id), loadPopReport(supabase, player.id), loadTeamPlaybook(supabase, player.id)]);
  const open = team.quizzes.filter((q) => q.answered < q.total || q.to_fix > 0).length;
  const positions = positionsOf(player);
  return (
    <SectionShell title="Softball IQ" subtitle="Defense IQ · Baserunning IQ · Offense IQ · Position IQ · Keep the Book · Extra Credit">
      {(team.cards.length > 0 || team.quizzes.length > 0) && (
        <Link
          href={`/players/${player.id}/iq/playbook`}
          className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pink/60 bg-pink/5 p-4 transition hover:border-pink hover:bg-pink/10"
        >
          <span>
            <span className="block font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Team Playbook</span>
            <span className="mt-1 block text-sm text-ink">
              {team.cards.length} call{team.cards.length === 1 ? "" : "s"} to know cold
              {team.quizzes.length > 0 && ` · ${team.quizzes.length} team quiz${team.quizzes.length === 1 ? "" : "zes"}${open ? ` (${open} open)` : ""}`}
            </span>
          </span>
          <span className="font-mono text-xs font-bold tracking-wider text-highlight uppercase">Flashcards →</span>
        </Link>
      )}
      <IqDetail
        playerId={player.id}
        quizzes={buildQuizzes(iq, positions)}
        tracks={buildTracks(iq)}
        badgeTracks={buildBadgeTracks(iq)}
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
