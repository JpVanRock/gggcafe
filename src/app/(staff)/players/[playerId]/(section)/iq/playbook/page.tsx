import type { Metadata } from "next";
import Link from "next/link";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, sectionLabelClass } from "@/components/ui";
import { loadPlayer } from "../../../section-data";
import { loadTeamPlaybook } from "../../../playbook-data";
import { Flashcards } from "../../../playbook-client";
import { SectionShell } from "../../section-shell";

export const metadata: Metadata = { title: "Team Playbook · Softball IQ · GGG.Cafe" };

export default async function TeamPlaybookPage({ params }: PageProps<"/players/[playerId]/iq/playbook">) {
  const { playerId } = await params;
  const supabase = await createClient();
  await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const { cards, quizzes } = await loadTeamPlaybook(supabase, player.id);
  return (
    <SectionShell title="Team Playbook" subtitle="Our calls · flashcards · team quizzes">
      <div className="flex flex-col gap-8">
        <Link href={`/players/${player.id}/iq`} className="text-sm text-link hover:underline">
          ← Softball IQ
        </Link>
        <section>
          <h2 className={`${sectionLabelClass} mb-3`}>Call sheet · {cards.length} call{cards.length === 1 ? "" : "s"}</h2>
          {cards.length ? <Flashcards cards={cards} /> : <EmptyState>Your coaches haven&apos;t put any calls on the sheet yet.</EmptyState>}
        </section>
        <section>
          <h2 className={`${sectionLabelClass} mb-3`}>Team quizzes</h2>
          {quizzes.length === 0 ? (
            <EmptyState>No team quizzes yet.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {quizzes.map((q) => {
                const done = q.answered === q.total;
                return (
                  <li key={q.id}>
                    <Link
                      href={`/players/${player.id}/iq/playbook/${q.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-700 bg-navy-950/40 p-4 transition hover:border-pink"
                    >
                      <span>
                        <span className="block font-semibold text-ink">{q.title}</span>
                        <span className="text-sm text-muted">
                          {q.team_name} · {q.total} question{q.total === 1 ? "" : "s"}
                          {q.answered > 0 && !done && ` · ${q.answered} answered`}
                          {done && ` · first try ${q.first_try}/${q.total}`}
                          {done && q.to_fix > 0 && ` · ${q.to_fix} to fix`}
                        </span>
                      </span>
                      <span className="font-mono text-xs font-bold tracking-wider text-pink-soft uppercase">
                        {done ? (q.to_fix ? "Fix →" : "Done ✓") : q.answered ? "Keep going →" : "Start →"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </SectionShell>
  );
}
