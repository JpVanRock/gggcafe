import type { Metadata } from "next";
import Link from "next/link";

import { COMMITMENT, GUIDE_TITLE, PLAN_LIMITS, RUBRIC, RUBRIC_LEVELS, RUBRIC_MAX, courseReady, guideProgress, lessonNumber, rubricTotal } from "@/lib/leadership-guide";
import { LeaderBadge } from "@/components/leader-badge";
import { CoachSignOff, PlanForm } from "../../../../leadership-client";
import { LeadershipClosed, leadershipContext, leadershipHref } from "../../../../leadership";
import { SectionShell } from "../../../section-shell";

export const metadata: Metadata = { title: "My Leadership Plan · G3 Leadership Guide · GGG.Cafe" };

export default async function LeadershipPlanPage({ params }: PageProps<"/players/[playerId]/advanced/leadership/plan">) {
  const { playerId } = await params;
  const { access, player, book, lead, certificate, name } = await leadershipContext(playerId);
  if (!lead.open) {
    return (
      <SectionShell title={GUIDE_TITLE} subtitle="G3 Advanced · Leadership">
        <LeadershipClosed playerId={player.id} name={name} hasAdvanced={book.unlocked} picked={lead.picked} canManage={access.canManage} />
      </SectionShell>
    );
  }
  const self = lead.work.find((w) => w.lesson === "rate-yourself")?.answers ?? {};
  const level = (v: string | undefined) => (v ? `${v} · ${RUBRIC_LEVELS[Number(v) - 1]}` : "–");
  const mine = rubricTotal(self);
  const coach = rubricTotal(lead.review.ratings);
  const progress = guideProgress(lead.work);
  const ready = courseReady(lead.work, lead.committedAt);

  return (
    <SectionShell title="My Leadership Plan" subtitle={`${name} · ${GUIDE_TITLE}`}>
      <div className="flex flex-col gap-10">
        <Link href={leadershipHref(player.id)} className="-mt-2 self-start text-sm text-pink hover:underline">
          ← Leadership Guide
        </Link>

        <section>
          <h2 className="mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Where I stand</h2>
          <div className="overflow-x-auto rounded-xl border border-navy-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] tracking-wider text-muted uppercase">
                  <th className="px-4 py-2 font-normal">Area</th>
                  <th className="px-4 py-2 font-normal">Me</th>
                  <th className="px-4 py-2 font-normal">My coach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {RUBRIC.map((r) => (
                  <tr key={r.key}>
                    <td className="px-4 py-2 font-semibold">{r.title}</td>
                    <td className="px-4 py-2">{level(self[r.key])}</td>
                    <td className="px-4 py-2">{level(lead.review.ratings[r.key])}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-navy-600 font-display font-bold tabular-nums">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2">{mine.rated ? `${mine.total} / ${RUBRIC_MAX}` : "–"}</td>
                  <td className="px-4 py-2">{coach.rated ? `${coach.total} / ${RUBRIC_MAX}` : "–"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            From{" "}
            <Link href={leadershipHref(player.id, "rate-yourself")} className="text-pink hover:underline">
              Lesson {lessonNumber("rate-yourself")}: Rate Your Leadership
            </Link>
            .
          </p>
        </section>

        <PlanForm playerId={player.id} plan={lead.plan} committedAt={lead.committedAt} commitment={COMMITMENT} canEdit={access.canAct} limits={PLAN_LIMITS} />

        <section className="border-t border-navy-700 pt-5">
          <h2 className="mb-3 font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Coach sign-off</h2>
          <p className="mb-3 text-sm text-muted">
            {progress.done} of {progress.total} lessons complete · plan {lead.committedAt ? "committed" : "not committed yet"}. The sign-off awards the
            Certificate of Leadership and the Leader Badge.
          </p>
          <CoachSignOff playerId={player.id} name={name} signed={Boolean(lead.review.signedAt)} ready={ready} canManage={access.canManage} />
          {certificate && (
            <Link href={leadershipHref(player.id, "certificate")} className="mt-4 inline-flex items-center gap-3 rounded-xl border border-neon/60 px-4 py-3 hover:bg-navy-800">
              <LeaderBadge size={28} />
              <span className="font-semibold">View &amp; print the certificate →</span>
            </Link>
          )}
        </section>
      </div>
    </SectionShell>
  );
}
