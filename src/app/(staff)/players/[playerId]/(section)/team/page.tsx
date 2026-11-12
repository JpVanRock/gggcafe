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
import { PhilosophyView, ThrowingView } from "@/components/team-programs";
import { SafetyNote } from "@/components/legal";
import { throwGroup, throwGroupFor, type PhilosophySection, type ThrowStep } from "@/lib/team-programs";

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
  const access = await requirePlayerPage(playerId, "player.team");
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

  // Phase 5: season goals, her pledge (current season) and spotlights, per team; the team's
  // hitting philosophy and her group's throwing program (user, 2026-11-12)
  const teamIds = teams.map((t) => t.team.id);
  const grp = throwGroupFor([player.primary_position, ...player.secondary_positions]);
  const [extras, { data: philosophies }, { data: programs }] = await Promise.all([
    loadTeamExtras(supabase, player.id, teamIds),
    teamIds.length
      ? supabase.from("team_hitting_philosophy").select("team_id, statement, sections").in("team_id", teamIds)
      : Promise.resolve({ data: [] as { team_id: string; statement: string | null; sections: PhilosophySection[] }[] }),
    teamIds.length && grp
      ? supabase.from("team_throwing_programs").select("team_id, intro, steps").in("team_id", teamIds).eq("grp", grp)
      : Promise.resolve({ data: [] as { team_id: string; intro: string | null; steps: ThrowStep[] }[] }),
  ]);
  const philosophy = new Map((philosophies ?? []).filter((p) => p.statement || p.sections.length).map((p) => [p.team_id, p]));
  const program = new Map((programs ?? []).filter((p) => p.intro || p.steps.length).map((p) => [p.team_id, p]));

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
              {philosophy.has(team.id) && (
                <section>
                  <Heading id={i === 0 ? "hitting" : `hitting-${team.id}`}>Team Hitting Philosophy</Heading>
                  <PhilosophyView statement={philosophy.get(team.id)!.statement} sections={philosophy.get(team.id)!.sections} />
                </section>
              )}
              {program.has(team.id) && grp && (
                <section>
                  <Heading id={i === 0 ? "throwing" : `throwing-${team.id}`}>
                    Throwing Program · {throwGroup(grp).label} ({throwGroup(grp).full.toLowerCase()})
                  </Heading>
                  <div className="flex flex-col gap-4">
                    <ThrowingView intro={program.get(team.id)!.intro} steps={program.get(team.id)!.steps} />
                    <SafetyNote audience="player" />
                  </div>
                </section>
              )}
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
