import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Disclosure, EmptyState, Loading } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import { TESTS, composite, cutoffsFor, rate, tierFor } from "@/lib/training-plan";
import { RatingChip } from "@/components/rating-chip";
import { loadOwnTeams } from "../../data";
import { TeamPicker } from "../../team-picker";
import { TrainingNav } from "../nav";
import { loadTeamAge, loadTeamRoster, loadTesting } from "../data";
import { BandsForm, ResultsForm } from "../forms";

export const metadata: Metadata = { title: "Testing · Training · Coaches Dugout · GGG.Cafe" };

// The athletic testing pack (Phase 2): results save as measurements; each is rated
// 1-5 against the team's age-group bands, with a composite score. Coaches only:
// players see their own results in Performance Training (no public rankings).
export default function TestingPage({ searchParams }: PageProps<"/dugout/training/testing">) {
  return (
    <Suspense fallback={<Loading />}>
      <Testing searchParams={searchParams} />
    </Suspense>
  );
}

const heading = "font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase";
const TIER_LABEL = { youth: "8U-10U", u12: "11U-12U", u14: "13U-14U", u16: "15U-16U", u18: "17U-18U" } as const;

async function Testing({ searchParams }: Pick<PageProps<"/dugout/training/testing">, "searchParams">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const teams = await loadOwnTeams(supabase);
  if (teams.length === 0) {
    return (
      <EmptyState>
        Add your team on the{" "}
        <Link href="/teams" className="text-pink hover:underline">
          Teams
        </Link>{" "}
        page first.
      </EmptyState>
    );
  }
  const team = teams.find((t) => t.id === teamParam) ?? teams[0];
  const [roster, ageGroup] = await Promise.all([loadTeamRoster(supabase, team.id), loadTeamAge(supabase, team.id)]);
  const { results, bands } = await loadTesting(supabase, roster.map((p) => p.id), TESTS.map((t) => t.key));
  const latest = (playerId: string, key: string) => results.find((r) => r.player_id === playerId && r.metric_key === key) ?? null;
  const tested = TESTS.filter((t) => results.some((r) => r.metric_key === t.key));

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/training/testing" />
      <TrainingNav current="testing" teamId={team.id} head={isHeadCoach(user.staff.role)} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className={heading}>Athletic testing</h2>
          <p className="mt-1 text-sm text-muted">
            {ageGroup ? `${ageGroup} bands (${TIER_LABEL[tierFor(ageGroup)]})` : "No age group on the team yet: using 13U-14U bands"}. Results save as
            measurements. Players see only their own, in Performance Training.
          </p>
        </div>

        {roster.length === 0 ? (
          <EmptyState>No one on the current roster yet.</EmptyState>
        ) : tested.length === 0 ? (
          <EmptyState>No results yet.{editor && " Enter the first testing session below."}</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-navy-700">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-navy-900">
                <tr>
                  <th className="px-3 py-2 text-left text-[0.75rem] leading-4 font-semibold tracking-wider text-muted uppercase">Player</th>
                  {tested.map((t) => (
                    <th key={t.key} className="px-2 py-2 text-left text-[0.75rem] leading-4 font-semibold tracking-wider text-muted uppercase">
                      {t.name.replace(/ \(.*\)/, "")}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left text-[0.75rem] leading-4 font-semibold tracking-wider text-highlight uppercase">Score</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => {
                  const ratings: number[] = [];
                  return (
                    <tr key={p.id} className="border-t border-navy-800">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/players/${p.id}/training`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      {tested.map((t) => {
                        const r = latest(p.id, t.key);
                        if (!r) return <td key={t.key} className="px-2 py-2 text-muted">–</td>;
                        const rating = rate(r.value, t.better, cutoffsFor(t, ageGroup, bands));
                        ratings.push(rating);
                        return (
                          <td key={t.key} className="px-2 py-2" title={`${formatDay(r.measured_on)}`}>
                            <span className="mr-1.5 font-display font-bold tabular-nums">
                              {r.value}
                              <span className="ml-0.5 text-xs font-normal text-muted">{t.unit}</span>
                            </span>
                            <RatingChip rating={rating} />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 font-display text-lg font-bold text-highlight tabular-nums">{composite(ratings) ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">Latest result for each test; the score is the average rating on a 100 scale.</p>
      </section>

      {editor && roster.length > 0 && (
        <Disclosure summary="Enter results from a testing session" open={tested.length === 0}>
          <ResultsForm roster={roster} today={todayISO()} />
        </Disclosure>
      )}

      {editor && ageGroup && (
        <Disclosure summary={`Rating bands for ${ageGroup}`}>
          <BandsForm
            ageGroup={ageGroup}
            bands={TESTS.map((t) => ({ key: t.key, cutoffs: [...cutoffsFor(t, ageGroup, bands)], own: bands.some((b) => b.metric_key === t.key && b.age_group === ageGroup) }))}
          />
        </Disclosure>
      )}

      <section className="flex flex-col gap-3">
        <h2 className={heading}>How to run each test</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TESTS.map((t) => (
            <li key={t.key} className="rounded-xl border border-navy-700 p-3 text-sm">
              <p className="font-semibold">{t.name}</p>
              <p className="text-muted">{t.how}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          Warm up first (the landing warm-up in the library works). Stop any test that hurts. Starter bands are a starting point for girls
          by age group; set your own in Rating bands.
        </p>
      </section>
    </div>
  );
}
