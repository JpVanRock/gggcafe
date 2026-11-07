// "From the Dugout": the slim bar above TWIS on a player's dashboard with Team
// Standards and Team Culture buttons. Each opens a pop-up with what her coaches
// wrote in the Coaches Dugout. Also used as the preview in the Dugout itself.
import Link from "next/link";
import { Modal } from "@/components/modal";
import { EmptyState } from "@/components/ui";
import { CultureStatement, StandardsList, hasCulture, type TeamCulture, type TeamStandard } from "@/components/team-standards";

export type DugoutTeam = {
  team: { id: string; name: string };
  culture: TeamCulture | null;
  standards: TeamStandard[];
};

const pill =
  "inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wider transition";

function TeamHeading({ name }: { name: string }) {
  return <h3 className="mb-4 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">{name}</h3>;
}

export function DugoutStrip({
  teams,
  canEdit,
  label = "From the Dugout",
  teamHref,
}: {
  teams: DugoutTeam[];
  canEdit: boolean;
  label?: string;
  /** the player's Team page: the buttons go there instead of opening pop-ups */
  teamHref?: string;
}) {
  if (teams.length === 0) return null;
  const names = teams.map((t) => t.team.name).join(" · ");
  const several = teams.length > 1;
  const writeLink = (teamId: string) =>
    canEdit && (
      <>
        {" "}
        <Link href={`/dugout?team=${teamId}`} className="text-pink hover:underline">
          Write them in the Coaches Dugout →
        </Link>
      </>
    );

  return (
    <section
      aria-label="Team Standards and Team Culture"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-navy-700 bg-navy-900/60 px-4 py-3 sm:px-5"
    >
      <div className="min-w-0">
        <p className="font-mono text-[0.75rem] leading-4 tracking-[0.25em] text-pink-soft uppercase">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-ink">{names}</p>
      </div>
      {teamHref ? (
        <div className="flex flex-wrap gap-2">
          <Link href={`${teamHref}#standards`} className={`${pill} bg-neon text-on-accent hover:bg-neon-bright`}>
            Team Standards
          </Link>
          <Link href={`${teamHref}#culture`} className={`${pill} border border-pink text-ink hover:bg-pink hover:text-on-accent`}>
            Team Culture
          </Link>
        </div>
      ) : (
      <div className="flex flex-wrap gap-2">
        <Modal
          title="Team Standards"
          subtitle={names}
          trigger="Team Standards"
          triggerClassName={`${pill} bg-neon text-on-accent hover:bg-neon-bright`}
        >
          <div className="flex flex-col gap-10">
            {teams.map(({ team, standards }) => (
              <section key={team.id}>
                {several && <TeamHeading name={team.name} />}
                {standards.length ? (
                  <StandardsList standards={standards} />
                ) : (
                  <EmptyState>
                    No team standards posted yet.
                    {writeLink(team.id)}
                  </EmptyState>
                )}
              </section>
            ))}
          </div>
        </Modal>
        <Modal
          title="Team Culture"
          subtitle={names}
          trigger="Team Culture"
          triggerClassName={`${pill} border border-pink text-ink hover:bg-pink hover:text-on-accent`}
        >
          <div className="flex flex-col gap-10">
            {teams.map(({ team, culture }) => (
              <section key={team.id}>
                {several && <TeamHeading name={team.name} />}
                {hasCulture(culture) ? (
                  <CultureStatement culture={culture} />
                ) : (
                  <EmptyState>
                    No team culture posted yet.
                    {canEdit && (
                      <>
                        {" "}
                        <Link href={`/dugout?team=${team.id}`} className="text-pink hover:underline">
                          Write it in the Coaches Dugout →
                        </Link>
                      </>
                    )}
                  </EmptyState>
                )}
              </section>
            ))}
          </div>
        </Modal>
      </div>
      )}
    </section>
  );
}
