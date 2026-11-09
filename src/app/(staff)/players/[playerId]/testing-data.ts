import "server-only";
// Her athletic testing results (Phase 2): the latest result per test, rated 1-5
// against her team's age-group bands, and her composite score.
import type { createClient } from "@/lib/supabase/server";
import { TESTS, composite, cutoffsFor, rate, type TestDef } from "@/lib/training-plan";
import { activeTeams } from "@/lib/roster";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MyTestResult = { test: TestDef; value: number; measured_on: string; rating: number; previous: number | null };
export type MyTesting = { results: MyTestResult[]; composite: number | null; ageGroup: string | null };

export async function loadMyTesting(supabase: Supabase, playerId: string): Promise<MyTesting> {
  const [teams, results, bands] = await Promise.all([
    activeTeams(supabase, playerId),
    supabase
      .from("measurements")
      .select("metric_key, value, measured_on")
      .eq("player_id", playerId)
      .in("metric_key", TESTS.map((t) => t.key))
      .order("measured_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("test_bands").select("metric_key, age_group, cutoffs"),
  ]);
  const ageGroup = teams.find((t) => t.is_own_team)?.age_group ?? null;
  const overrides = ((bands.data ?? []) as { metric_key: string; age_group: string; cutoffs: number[] }[]).map((b) => ({ ...b, cutoffs: b.cutoffs.map(Number) }));
  const rows = ((results.data ?? []) as { metric_key: string; value: number; measured_on: string }[]).map((r) => ({ ...r, value: Number(r.value) }));
  const out: MyTestResult[] = [];
  for (const test of TESTS) {
    const mine = rows.filter((r) => r.metric_key === test.key);
    if (!mine.length) continue;
    out.push({
      test,
      value: mine[0].value,
      measured_on: mine[0].measured_on,
      rating: rate(mine[0].value, test.better, cutoffsFor(test, ageGroup, overrides)),
      previous: mine[1]?.value ?? null,
    });
  }
  return { results: out, composite: composite(out.map((r) => r.rating)), ageGroup };
}
