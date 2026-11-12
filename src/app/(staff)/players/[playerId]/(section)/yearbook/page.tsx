import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadYearbook } from "@/lib/yearbook-data";
import { YearbookView } from "@/components/yearbook-view";
import { EmptyState } from "@/components/ui";
import { loadTeamDugout } from "../../data";
import { loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";
import { pickTeam } from "../../../../dugout/team-picker";

export const metadata: Metadata = { title: "Yearbook · GGG.Cafe" };

export default async function YearbookPage({ params, searchParams }: PageProps<"/players/[playerId]/yearbook">) {
  const { playerId } = await params;
  const { team: teamParam, season } = await searchParams;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId, "player.yearbook");
  const player = await loadPlayer(supabase, playerId);
  const teams = (await loadTeamDugout(supabase, player.id)).map((t) => t.team);
  const team = pickTeam(teams, teamParam);
  const loaded = team ? await loadYearbook(supabase, team.id, typeof season === "string" ? season : null) : null;
  // the Yearbook is G3 Advanced: nobody else learns it exists
  if (!loaded && !access.user.staff) notFound();
  const base = `/players/${player.id}/yearbook`;
  return (
    <SectionShell title="Yearbook" subtitle={team ? `${team.name} · G3 Advanced` : "G3 Advanced"}>
      <div className="flex flex-col gap-6">
        {teams.length > 1 && (
          <nav aria-label="Team" className="flex flex-wrap gap-1.5">
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`${base}?team=${t.id}`}
                aria-current={t.id === team?.id ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  t.id === team?.id ? "border-pink bg-pink text-on-accent" : "border-navy-600 text-muted hover:border-pink hover:text-ink"
                }`}
              >
                {t.name}
              </Link>
            ))}
          </nav>
        )}
        {loaded ? (
          <YearbookView data={loaded.yearbook} urls={loaded.urls} seasonLink={`${base}?team=${team!.id}&season=`} />
        ) : (
          <EmptyState>{team ? "The Yearbook is part of G3 Advanced." : "She isn't on one of our teams right now."}</EmptyState>
        )}
      </div>
    </SectionShell>
  );
}
