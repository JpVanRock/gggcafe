import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getMentor, getMentorAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState } from "@/components/ui";
import { playerName } from "@/lib/softball";
import { TrainingForm } from "../mentor-client";
import { TrainingList, loadMentees, loadTraining, trainingGroups } from "../parts";

export const metadata: Metadata = { title: "Training on their weeks · Mentor · GGG.Cafe" };

// The mentor menu's Training on their weeks (user, 2026-11-13; it was on the mentor home): add
// training for one player or a group, once or every week, and take it off again. It shows in their
// This Week in Softball on those days, marked as from her.
export default async function MentorTrainingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const mentor = await getMentor();
  if (!mentor) redirect("/mentor");
  const access = await getMentorAccess();
  const supabase = await createClient();
  const [cards, training, { data: teamRows }] = await Promise.all([
    loadMentees(supabase, access.menteeIds),
    loadTraining(supabase, mentor.userId),
    access.teamIds.length ? supabase.from("teams").select("id, name").in("id", access.teamIds).order("name") : Promise.resolve({ data: [] }),
  ]);
  const groups = trainingGroups(access, teamRows ?? [], cards);
  const nameOf = (id: string) => {
    const c = cards.get(id);
    return c ? playerName(c.player) : "A player";
  };

  return (
    <div className="flex flex-col gap-8">
      <Link href="/mentor" className="self-start text-sm text-muted hover:text-ink">
        <span aria-hidden="true">←</span> Mentor menu
      </Link>
      <header>
        <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Mentor menu</p>
        <h1 className="mt-1 text-4xl leading-none font-bold tracking-tight text-highlight uppercase sm:text-5xl">Training on their weeks</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Tick one player or a group. It shows in their This Week in Softball on those days, marked as from you, and on your calendar.
        </p>
      </header>
      {access.menteeIds.length === 0 ? (
        <EmptyState>Once you&apos;re approved for a player or a team, you can add training to their weeks here.</EmptyState>
      ) : (
        <>
          <Card title="Add training">
            <TrainingForm groups={groups} />
          </Card>
          <section aria-labelledby="training-list">
            <h2 id="training-list" className="mb-3 font-mono text-xs font-bold tracking-[0.2em] text-pink-soft uppercase">
              Coming up
            </h2>
            <TrainingList rows={training} nameOf={nameOf} />
          </section>
        </>
      )}
    </div>
  );
}
