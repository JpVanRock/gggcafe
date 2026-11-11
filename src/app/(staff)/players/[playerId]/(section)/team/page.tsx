import type { Metadata } from "next";
import Link from "next/link";
import { requirePlayerPage, isHeadCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, eyebrowClass } from "@/components/ui";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { CultureStatement, StandardsList, hasCulture } from "@/components/team-standards";
import { loadTeamDugout } from "../../data";
import { loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";
import { formatDay } from "@/lib/dates";
import { pledgeLine, pledgeStatus } from "@/lib/culture";
import { GoalsBoard } from "@/app/(staff)/dugout/culture-team";
import { loadTeamExtras } from "../../team-culture-data";
import { PledgeForm } from "../../team-culture-client";
import { playerName } from "@/lib/softball";

export const metadata: Metadata = { title: "Team Standards & Culture · GGG.Cafe" };

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-5 scroll-mt-40 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">
      {children}
    </h2>
  );
}

export default async function TeamPage({ params }: PageProps<"/players/[playerId]/team">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const teams = await loadTeamDugout(supabase, player.id);
  const write = (teamId: string) =>
    access.user.staff && isHeadCoach(access.user.staff.role) && (
      <>
        {" "}
        <Link href={`/dugout?team=${teamId}`} className="text-link hover:underline">
          Write it in the Coaches Dugout →
        </Link>
      </>
    );

  // Phase 5: season goals, her pledge (current season) and spotlights, per team
  const extras = await loadTeamExtras(supabase, player.id, teams.map((t) => t.team.id));

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
              {(extras.goals.get(team.id)?.length ?? 0) > 0 && (
                <section>
                  <Heading id={i === 0 ? "goals" : `goals-${team.id}`}>Season goals</Heading>
                  <GoalsBoard goals={extras.goals.get(team.id)!} />
                </section>
              )}
              {standards.length > 0 && (
                <section>
                  <Heading id={i === 0 ? "pledge" : `pledge-${team.id}`}>My commitment</Heading>
                  {(() => {
                    const pledge = extras.pledges.get(team.id) ?? null;
                    const titles = standards.map((st) => st.title);
                    const status = pledgeStatus(pledge);
                    return (
                      <div className="flex flex-col gap-4">
                        <p className="text-sm text-muted">
                          One &ldquo;I will…&rdquo; that covers every Team Standard, then sign the team pledge.
                          {status.signed && pledge?.signed_at ? ` Signed by ${pledge.signed_name} on ${formatDay(pledge.signed_at.slice(0, 10))}.` : ""}
                        </p>
                        {access.canAct ? (
                          <PledgeForm
                            playerId={player.id}
                            teamId={team.id}
                            standards={titles}
                            line={pledgeLine(pledge?.lines)}
                            signedName={pledge?.signed_name ?? null}
                            signedAt={pledge?.signed_at ?? null}
                            defaultName={playerName(player)}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-line">{pledgeLine(pledge?.lines) || "–"}</p>
                        )}
                      </div>
                    );
                  })()}
                </section>
              )}
              {(extras.spotlights.get(team.id)?.length ?? 0) > 0 && (
                <section>
                  <Heading id={i === 0 ? "spotlight" : `spotlight-${team.id}`}>Player Spotlight</Heading>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {extras.spotlights.get(team.id)!.map((sp) => (
                      <li key={sp.id} className="rounded-2xl border border-pink/50 bg-pink/5 p-4">
                        <p className={eyebrowClass}>
                          {sp.jersey ? `#${sp.jersey} · ` : ""}
                          {sp.player_name}
                        </p>
                        <p className="mt-1 font-display text-xl font-bold tracking-wide uppercase">{sp.headline}</p>
                        <p className="mt-1 line-clamp-3 text-sm text-ink/90">{sp.body}</p>
                        <Link href={`/players/${player.id}/spotlight/${sp.id}`} className="mt-2 inline-block text-sm font-semibold text-link hover:underline">
                          The media-day graphic →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ))}
        </div>
      )}
      <ScrollToHash />
    </SectionShell>
  );
}
