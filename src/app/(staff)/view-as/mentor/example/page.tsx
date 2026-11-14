import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import { comingUp } from "@/lib/family";
import { loadRoster } from "@/lib/roster";
import { loadComingUp } from "@/app/family/team-data";
import { loadDugoutTeam } from "../../../dugout/data";
import { NoOwnTeam } from "../../../dugout/team-picker";
import { ViewToggle, requireAdminPage } from "../../parts";
import { MentorPreview } from "../preview";

export const metadata: Metadata = { title: "Mentor view (example) · GGG.Cafe" };

/**
 * Admins: what a mentor sees, for a team with no mentors yet (user, 2026-11-14: "the toggle for mentor
 * view does not work" while the team had none). An example mentor the head coach approved for the whole
 * team, with the team's real roster and schedule; no training or messages yet. Read only.
 */
export default async function ExampleMentorViewPage({ searchParams }: PageProps<"/view-as/mentor/example">) {
  await requireAdminPage();
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { team } = dugout;
  const [roster, teamItems] = await Promise.all([loadRoster(supabase, team.id, { order: "name" }), loadComingUp(supabase, [team], 20)]);
  const players = roster.map((p) => ({ id: p.id, name: p.name, jersey: p.number, position: p.primary, team: team.name }));

  return (
    <div className="flex flex-col gap-8">
      <ViewToggle kind="mentor" current="view" coachHref={`/dugout/mentors?team=${team.id}`} viewHref={`/view-as/mentor/example?team=${team.id}`} />
      <div className="flex flex-col gap-2 rounded-2xl border-2 border-pink bg-pink/5 p-4 sm:p-5">
        <p className="font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase">Admin · example mentor view · read only</p>
        <p className="text-lg font-semibold text-ink">What a mentor sees on {team.name}</p>
        <p className="text-sm text-muted">
          {team.name} has no mentors yet, so this is an example: a mentor the head coach approved for the whole team, with your real roster and
          schedule. Mentors sign up with the team code, then ask to work with one player (her parents approve) or the whole team (the head coach
          approves). Once one is approved, Mentor view shows them instead.
        </p>
      </div>

      <section aria-label="An example mentor page" className="flex flex-col gap-10 rounded-2xl border-2 border-navy-700 p-4 sm:p-6">
        <MentorPreview
          name="Example Mentor"
          line={`Mentor · ${players.length} player${players.length === 1 ? "" : "s"} · ${team.name}`}
          requests={[]}
          players={players}
          upcoming={comingUp(teamItems, 8)}
          calendarHref={`/dugout/calendar?team=${team.id}`}
          sessions={[]}
          messages={[]}
        />
        {players.length === 0 && <EmptyState>Once players are on the roster, a whole-team mentor sees them here.</EmptyState>}
      </section>
    </div>
  );
}
