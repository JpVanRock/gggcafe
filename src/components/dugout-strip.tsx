// "From the Dugout": the slim bar above TWIS on a player's dashboard with Team
// Standards and Team Culture buttons. Each opens a pop-up with what her coaches
// wrote in the Coaches Dugout. Also used as the preview in the Dugout itself.
// On her dashboard it also has the Leaderboard and + Activity pills
// (Offseason Training, user 2026-11-08).
import Link from "next/link";
import { Modal } from "@/components/modal";
import { EmptyState, eyebrowClass } from "@/components/ui";
import { CultureStatement, StandardsList, hasCulture, type TeamCulture, type TeamStandard } from "@/components/team-standards";
import {
  COACHING_ETIQUETTE, COACHING_ETIQUETTE_MOTTO, COACHING_ETIQUETTE_TITLE, COACH_RESPONSIBILITIES, COACH_RESPONSIBILITIES_MOTTO,
  COACH_RESPONSIBILITIES_TITLE,
} from "@/lib/coach-responsibilities";

export type DugoutTeam = {
  team: { id: string; name: string };
  culture: TeamCulture | null;
  standards: TeamStandard[];
};

const pill =
  "inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-wider transition";

function TeamHeading({ name }: { name: string }) {
  return <h3 className="mb-4 font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">{name}</h3>;
}

export function DugoutStrip({
  teams,
  canEdit,
  label = "From the Dugout",
  teamHref,
  yearbookHref,
  leaderboardHref,
  activityHref,
  coachResponsibilities = false,
}: {
  teams: DugoutTeam[];
  canEdit: boolean;
  label?: string;
  /** the player's Team page: the buttons go there instead of opening pop-ups */
  teamHref?: string;
  /** the Team Yearbook (G3 Advanced): between Team Culture and Leaderboard */
  yearbookHref?: string;
  /** her Offseason Training Leaderboard */
  leaderboardHref?: string;
  /** + Activity: log a session */
  activityHref?: string;
  /** the Coaches Dugout only: Coach's Responsibilities, first (coaches see it; players don't) */
  coachResponsibilities?: boolean;
}) {
  if (teams.length === 0) return null;
  const names = teams.map((t) => t.team.name).join(" · ");
  const several = teams.length > 1;
  const writeLink = (teamId: string) =>
    canEdit && (
      <>
        {" "}
        <Link href={`/dugout?team=${teamId}`} className="text-link hover:underline">
          Write them in the Coaches Dugout →
        </Link>
      </>
    );

  const extraPills = (
    <>
      {yearbookHref && (
        <Link href={yearbookHref} className={`${pill} border border-ink/70 text-ink hover:bg-ink hover:text-navy-950`}>
          Yearbook
        </Link>
      )}
      {leaderboardHref && (
        <Link href={leaderboardHref} className={`${pill} bg-pink text-on-accent hover:brightness-110`}>
          Leaderboard
        </Link>
      )}
      {activityHref && (
        <Link href={activityHref} className={`${pill} border border-neon text-highlight hover:bg-neon hover:text-on-accent`}>
          + Activity
        </Link>
      )}
    </>
  );

  return (
    <section
      aria-label="From the Dugout"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-navy-700 bg-navy-900/60 px-4 py-3 sm:px-5"
    >
      <div className="min-w-0">
        <p className={eyebrowClass}>{label}</p>
        {teams.map((t) => t.culture?.motto).filter(Boolean).slice(0, 1).map((m) => (
          <p key={m} className="font-display text-sm font-bold tracking-wide text-highlight uppercase italic">“{m}”</p>
        ))}
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
          {extraPills}
        </div>
      ) : (
      <div className="flex flex-wrap gap-2">
        {coachResponsibilities && (
          <Modal
            title={COACH_RESPONSIBILITIES_TITLE}
            subtitle="Coaches only"
            trigger={COACH_RESPONSIBILITIES_TITLE}
            triggerClassName={`${pill} border border-neon text-highlight hover:bg-neon hover:text-on-accent`}
          >
            <div className="flex flex-col gap-6">
              <p className="font-display text-2xl font-bold tracking-wide text-link italic">{COACH_RESPONSIBILITIES_MOTTO}</p>
              <ol className="grid gap-2 sm:grid-cols-2">
                {COACH_RESPONSIBILITIES.map((r, i) => (
                  <li key={r.text} className="flex items-baseline gap-3 border-b border-navy-700 pb-2">
                    <span className="w-7 shrink-0 font-display text-lg font-bold text-highlight tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <span className={r.key ? "font-bold text-ink italic" : "text-ink/90"}>{r.text}</span>
                  </li>
                ))}
              </ol>
              <section className="flex flex-col gap-3 border-t-2 border-pink pt-5">
                <h3 className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">{COACHING_ETIQUETTE_TITLE}</h3>
                <p className="font-display text-2xl font-bold tracking-wide text-link italic">{COACHING_ETIQUETTE_MOTTO}</p>
                {COACHING_ETIQUETTE.map((p) => (
                  <p key={p} className="text-ink/90">
                    {p}
                  </p>
                ))}
              </section>
            </div>
          </Modal>
        )}
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
                        <Link href={`/dugout?team=${team.id}`} className="text-link hover:underline">
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
        {extraPills}
      </div>
      )}
    </section>
  );
}
