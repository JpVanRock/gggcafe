// The team on the family menu (user, 2026-11-13): the team's standards, culture and season goals,
// and each daughter's goals and team commitment. View only; data from ./team-data.ts.
import { CultureStatement, StandardsList, hasCulture } from "@/components/team-standards";
import { GoalsBoard } from "@/app/(staff)/dugout/culture-team";
import { GoalsSummary } from "@/app/(staff)/players/[playerId]/goals";
import { SmartSummary } from "@/app/(staff)/players/[playerId]/smart";
import { formatDay } from "@/lib/dates";
import type { DaughterGoals, FamilyTeamCulture } from "./team-data";

/** A team's standards, culture statement and season goals, as the players see them (the family Team page). */
export function TeamCultureSection({ data, showTeam }: { data: FamilyTeamCulture; showTeam: boolean }) {
  const { team, standards, culture, goals } = data;
  const H = showTeam ? "h3" : "h2";
  const heading = "mb-4 font-mono text-xs font-bold tracking-[0.2em] text-pink-soft uppercase";
  return (
    <section aria-label={`${team.name} Team Standards & Culture`} className="flex flex-col gap-8">
      {showTeam && <h2 className="font-display text-2xl leading-tight font-bold tracking-wide text-highlight uppercase">{team.name}</h2>}
      {standards.length > 0 && (
        <div>
          <H className={heading}>Team Standards</H>
          <StandardsList standards={standards} />
        </div>
      )}
      {hasCulture(culture) && (
        <div>
          <H className={heading}>Team Culture</H>
          <CultureStatement culture={culture} />
        </div>
      )}
      {goals.length > 0 && (
        <div>
          <H className={heading}>Season goals</H>
          <GoalsBoard goals={goals} />
        </div>
      )}
    </section>
  );
}

/** Whether a team posted anything parents would see. */
export const hasTeamCulture = (d: FamilyTeamCulture) => d.standards.length > 0 || hasCulture(d.culture) || d.goals.length > 0;

/** Her goals (as on her dashboard) and her commitment to each team, for her board on the family menu. */
export function GoalsBoardSummary({ first, goals }: { first: string; goals: DaughterGoals }) {
  const unset = goals.method === "smart" ? goals.smart.length === 0 : !goals.chart;
  return (
    <div className="flex flex-col gap-6">
      {unset ? (
        <p className="text-sm text-[var(--menu-note)]">{first} hasn&apos;t set her goals yet. They show here once she does.</p>
      ) : goals.method === "smart" ? (
        <SmartSummary goals={goals.smart} metrics={goals.metrics} />
      ) : (
        <GoalsSummary chart={goals.chart} />
      )}
      {goals.pledges.length > 0 && (
        <div>
          <p className="font-mono text-xs font-bold tracking-[0.2em] uppercase">Her commitment to the team</p>
          <ul className="mt-2 flex flex-col gap-2">
            {goals.pledges.map((p) => (
              <li key={p.team.id} className="text-sm">
                {goals.pledges.length > 1 && <span className="font-semibold">{p.team.name}: </span>}
                {p.line ? `“${p.line}”` : "Not written yet."}{" "}
                <span className="text-[var(--menu-note)]">
                  {p.signedAt ? `Signed ${formatDay(p.signedAt.slice(0, 10))}` : "Not signed yet"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
