import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Loading } from "@/components/ui";
import { CultureStatement, StandardsList, hasCulture } from "@/components/team-standards";
import { loadTeamDugout } from "../../data";
import { loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Team Standards & Culture · GGG.Cafe" };

export default function TeamPage({ params }: PageProps<"/players/[playerId]/team">) {
  return (
    <Suspense fallback={<Loading />}>
      <Team params={params} />
    </Suspense>
  );
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-5 scroll-mt-24 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">
      {children}
    </h2>
  );
}

async function Team({ params }: Pick<PageProps<"/players/[playerId]/team">, "params">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const teams = await loadTeamDugout(supabase, player.id);
  const write = (teamId: string) =>
    access.canManage && (
      <>
        {" "}
        <Link href={`/dugout?team=${teamId}`} className="text-pink hover:underline">
          Write it in the Coaches Dugout →
        </Link>
      </>
    );

  return (
    <SectionShell title="Team Standards & Culture" subtitle={teams.map((t) => t.team.name).join(" · ") || undefined}>
      {teams.length === 0 ? (
        <EmptyState>Not on one of our team rosters right now.</EmptyState>
      ) : (
        <div className="flex flex-col gap-12">
          {teams.map(({ team, standards, culture }, i) => (
            <div key={team.id} className="flex flex-col gap-12">
              {teams.length > 1 && <p className="font-display text-2xl font-bold text-highlight uppercase">{team.name}</p>}
              <section>
                <Heading id={i === 0 ? "standards" : `standards-${team.id}`}>Team Standards</Heading>
                {standards.length ? <StandardsList standards={standards} /> : <EmptyState>No team standards posted yet.{write(team.id)}</EmptyState>}
              </section>
              <section>
                <Heading id={i === 0 ? "culture" : `culture-${team.id}`}>Team Culture</Heading>
                {hasCulture(culture) ? <CultureStatement culture={culture} /> : <EmptyState>No team culture posted yet.{write(team.id)}</EmptyState>}
              </section>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
