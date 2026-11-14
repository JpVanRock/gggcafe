// The team on the family page (user, 2026-11-13): Coming up (the next events and games), the
// team's standards, culture and season goals, and each daughter's goals and team commitment.
// View only; data from ./team-data.ts.
import Link from "next/link";
import { Card } from "@/components/ui";
import { CultureStatement, StandardsList, hasCulture } from "@/components/team-standards";
import { GoalsBoard } from "@/app/(staff)/dugout/culture-team";
import { GoalsSummary } from "@/app/(staff)/players/[playerId]/goals";
import { SmartSummary } from "@/app/(staff)/players/[playerId]/smart";
import { DetailHeading } from "@/app/(staff)/players/[playerId]/menu";
import { possessive } from "@/app/(staff)/players/[playerId]/data";
import { byDay, type ComingUpItem } from "@/lib/family";
import { clockLabel, parseClock } from "@/lib/dugout";
import { formatDay } from "@/lib/dates";
import { GOAL_METHOD_LABEL } from "@/lib/softball";
import type { DaughterGoals, FamilyTeam, FamilyTeamCulture } from "./team-data";

const time = (t: string | null) => {
  const m = parseClock(t);
  return m === null ? null : clockLabel(m).replace(":00 ", " ");
};

const linkClass = "text-sm font-semibold text-link hover:underline";

/** The next three weeks of practices, events and games, by day. */
export function ComingUpCard({ items, teams, calendarHref }: { items: ComingUpItem[]; teams: FamilyTeam[]; calendarHref: string }) {
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  return (
    <Card
      title="Coming up"
      actions={
        <Link href={calendarHref} className={linkClass}>
          Full calendar <span aria-hidden="true">→</span>
        </Link>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing on the team calendar in the next three weeks.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {byDay(items).map((day) => (
            <li key={day.date}>
              <p className="font-display text-sm font-bold tracking-wide text-highlight uppercase">{formatDay(day.date)}</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {day.items.map((i) => (
                  <li
                    key={i.key}
                    className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg border-l-[3px] bg-navy-800/60 px-3 py-2 text-sm ${i.game ? "border-l-pink" : "border-l-neon"}`}
                  >
                    <span className="w-16 shrink-0 font-display text-muted tabular-nums">{time(i.start) ?? "TBA"}</span>
                    <span className="font-semibold">{i.game ? `Game ${i.title}` : i.title}</span>
                    {i.place && <span className="text-muted">{i.place}</span>}
                    {teams.length > 1 && <span className="text-xs text-muted">{teamName.get(i.teamId)}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** A team's standards, culture statement and season goals, as the players see them. */
export function TeamCultureSection({ data }: { data: FamilyTeamCulture }) {
  const { team, standards, culture, goals } = data;
  return (
    <section aria-label={`${team.name} Team Standards & Culture`} className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{team.name}</p>
        <h2 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">Team Standards &amp; Culture</h2>
        <p className="mt-1 text-sm text-muted">What the team expects of every player and the team it wants to be, from the coaches.</p>
      </div>
      {standards.length > 0 && (
        <div>
          <DetailHeading>Team Standards</DetailHeading>
          <StandardsList standards={standards} />
        </div>
      )}
      {hasCulture(culture) && (
        <div>
          <DetailHeading>Team Culture</DetailHeading>
          <CultureStatement culture={culture} />
        </div>
      )}
      {goals.length > 0 && (
        <div>
          <DetailHeading>Season goals</DetailHeading>
          <GoalsBoard goals={goals} />
        </div>
      )}
    </section>
  );
}

/** Whether a team posted anything parents would see. */
export const hasTeamCulture = (d: FamilyTeamCulture) => d.standards.length > 0 || hasCulture(d.culture) || d.goals.length > 0;

/** Her goals (as on her dashboard) and her commitment to each team, view only. */
export function DaughterGoalsCard({ first, goals, fullHref }: { first: string; goals: DaughterGoals; fullHref: string | null }) {
  return (
    <Card
      title={`${possessive(first)} goals · ${GOAL_METHOD_LABEL[goals.method]}`}
      actions={
        fullHref && (
          <Link href={fullHref} className={linkClass}>
            All her goals <span aria-hidden="true">→</span>
          </Link>
        )
      }
    >
      {(goals.method === "smart" ? goals.smart.length === 0 : !goals.chart) ? (
        <p className="text-sm text-muted">{first} hasn&apos;t set her goals yet. They show here once she does.</p>
      ) : (
        // the dashboard's menu-board summary, in this card's colors
        <div className="[--menu-note:var(--color-muted)] [--menu-value:var(--color-highlight)]">
          {goals.method === "smart" ? <SmartSummary goals={goals.smart} metrics={goals.metrics} /> : <GoalsSummary chart={goals.chart} />}
        </div>
      )}
      {goals.pledges.length > 0 && (
        <div className="mt-6 border-t border-navy-700 pt-4">
          <DetailHeading>Her commitment to the team</DetailHeading>
          <ul className="flex flex-col gap-3">
            {goals.pledges.map((p) => (
              <li key={p.team.id}>
                {goals.pledges.length > 1 && <p className="text-xs text-muted">{p.team.name}</p>}
                <p className="text-sm whitespace-pre-line">{p.line ? `“${p.line}”` : "Not written yet."}</p>
                <p className="mt-1 text-xs text-muted">
                  {p.signedAt ? `Signed by ${p.signedName ?? first} on ${formatDay(p.signedAt.slice(0, 10))}` : "Not signed yet"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
