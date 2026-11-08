import "server-only";
// Her season stats from box scores, with every stat explaining itself ("How it's
// figured": tap the abbreviation), plus quality at-bats and BP production.
import type { ReactNode } from "react";
import type { createClient } from "@/lib/supabase/server";
import { StatTerm } from "@/components/stat-term";
import { qabSummary } from "@/lib/box-score";
import { rateLabel, type StatKey } from "@/lib/stat-formulas";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Batting = { games: number; pa: number; ab: number; h: number; doubles: number; triples: number; hr: number; rbi: number; bb: number; so: number; sb: number; avg: number | null; obp: number | null; slg: number | null; ops: number | null; k_pct: number | null; bb_pct: number | null };
type Pitching = { games: number; ip: string; outs: number; so: number; bb: number; era: number | null; whip: number | null; k_per_7: number | null; bb_per_7: number | null; strike_pct: number | null; wins: number; losses: number };
type Fielding = { games: number; po: number; a: number; e: number; fpct: number | null; cs_pct: number | null; sb_allowed: number; cs: number };
type Qab = { graded: number; qab_pct: number | null; production: number | null };

export async function loadPlayerStats(supabase: Supabase, playerId: string, seasonId: string | null) {
  if (!seasonId) return null;
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const [b, p, f, q, bp] = await Promise.all([
    supabase.from("batting_season").select("*").eq("player_id", playerId).eq("season_id", seasonId),
    supabase.from("pitching_season").select("*").eq("player_id", playerId).eq("season_id", seasonId),
    supabase.from("fielding_season").select("*").eq("player_id", playerId).eq("season_id", seasonId),
    supabase.from("qab_season").select("graded, qab_pct, production").eq("player_id", playerId).eq("season_id", seasonId),
    supabase.from("bp_rounds").select("grades").eq("player_id", playerId).gte("round_date", since),
  ]);
  const num = <T extends object>(rows: unknown): T | null => {
    const list = (rows ?? []) as Record<string, unknown>[];
    if (list.length === 0) return null;
    // several teams in one season: show the one with the most games
    const row = [...list].sort((x, y) => Number(y.games ?? 0) - Number(x.games ?? 0))[0];
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && k !== "ip" ? Number(v) : v])) as T;
  };
  const qabRows = (q.data ?? []) as { graded: number; qab_pct: string | null; production: string | null }[];
  const graded = qabRows.reduce((a, r) => a + r.graded, 0);
  const qab: Qab | null = graded
    ? {
        graded,
        qab_pct: Math.round((10 * qabRows.reduce((a, r) => a + Number(r.qab_pct ?? 0) * r.graded, 0)) / graded) / 10,
        production: Math.round((100 * qabRows.reduce((a, r) => a + Number(r.production ?? 0) * r.graded, 0)) / graded) / 100,
      }
    : null;
  const swings = ((bp.data ?? []) as { grades: number[] }[]).flatMap((r) => r.grades);
  return {
    batting: num<Batting>(b.data),
    pitching: num<Pitching>(p.data),
    fielding: num<Fielding>(f.data),
    qab,
    bp: swings.length ? qabSummary(swings) : null,
  };
}

function Stat({ label, k, value }: { label?: string; k?: StatKey; value: ReactNode }) {
  return (
    <div className="min-w-14">
      <dt className="font-mono text-[10px] font-bold tracking-wider text-muted uppercase">{k ? <StatTerm k={k} /> : label}</dt>
      <dd className="font-display text-xl font-bold text-highlight tabular-nums">{value}</dd>
    </div>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-950/40 p-3">
      <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.18em] text-pink-soft uppercase">{title}</p>
      <dl className="flex flex-wrap gap-x-5 gap-y-3">{children}</dl>
    </div>
  );
}

export function StatsCard({ stats, seasonLabel }: { stats: Awaited<ReturnType<typeof loadPlayerStats>>; seasonLabel: string | null }) {
  const has = stats && (stats.batting || stats.pitching || stats.fielding || stats.qab || stats.bp);
  return (
    <section className="mt-10 flex flex-col gap-3">
      <h2 className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">
        Season stats{seasonLabel ? ` · ${seasonLabel}` : ""}
      </h2>
      {!has ? (
        <p className="text-sm text-muted">No box scores yet this season. Tap any stat once they&apos;re in to see how it&apos;s figured.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {stats.batting && (
            <Row title={`Hitting · ${stats.batting.games} G`}>
              <Stat k="AVG" value={rateLabel(stats.batting.avg)} />
              <Stat k="OBP" value={rateLabel(stats.batting.obp)} />
              <Stat k="SLG" value={rateLabel(stats.batting.slg)} />
              <Stat k="OPS" value={rateLabel(stats.batting.ops)} />
              <Stat label="H" value={stats.batting.h} />
              <Stat label="2B" value={stats.batting.doubles} />
              <Stat label="HR" value={stats.batting.hr} />
              <Stat label="RBI" value={stats.batting.rbi} />
              <Stat label="SB" value={stats.batting.sb} />
              <Stat k="K%" value={stats.batting.k_pct ?? "–"} />
              <Stat k="BB%" value={stats.batting.bb_pct ?? "–"} />
            </Row>
          )}
          {(stats.qab || stats.bp) && (
            <Row title="Quality at-bats & BP">
              {stats.qab && <Stat k="QAB%" value={stats.qab.qab_pct ?? "–"} />}
              {stats.qab && <Stat k="PROD" value={stats.qab.production?.toFixed(2) ?? "–"} />}
              {stats.qab && <Stat label="Graded PA" value={stats.qab.graded} />}
              {stats.bp && <Stat label="BP prod" value={stats.bp.production?.toFixed(2) ?? "–"} />}
              {stats.bp && <Stat label="BP swings" value={stats.bp.graded} />}
            </Row>
          )}
          {stats.pitching && (
            <Row title={`Pitching · ${stats.pitching.games} G · ${stats.pitching.wins}-${stats.pitching.losses}`}>
              <Stat k="IP" value={stats.pitching.ip} />
              <Stat k="ERA" value={stats.pitching.era ?? "–"} />
              <Stat k="WHIP" value={stats.pitching.whip ?? "–"} />
              <Stat k="K/7" value={stats.pitching.k_per_7 ?? "–"} />
              <Stat k="BB/7" value={stats.pitching.bb_per_7 ?? "–"} />
              <Stat k="STR%" value={stats.pitching.strike_pct ?? "–"} />
            </Row>
          )}
          {stats.fielding && (
            <Row title={`Fielding · ${stats.fielding.games} G`}>
              <Stat k="FPCT" value={rateLabel(stats.fielding.fpct)} />
              <Stat label="PO" value={stats.fielding.po} />
              <Stat label="A" value={stats.fielding.a} />
              <Stat label="E" value={stats.fielding.e} />
              {stats.fielding.sb_allowed + stats.fielding.cs > 0 && <Stat k="CS%" value={stats.fielding.cs_pct ?? "–"} />}
            </Row>
          )}
        </div>
      )}
    </section>
  );
}
