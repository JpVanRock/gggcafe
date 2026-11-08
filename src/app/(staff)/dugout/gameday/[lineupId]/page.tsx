import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { canEdit, requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, Loading, pillButtonClass, pillOutlineClass, pillQuietClass } from "@/components/ui";
import { formatLongDate } from "@/lib/dates";
import { emailConfigured } from "@/lib/email";
import { BASE_RUNNING_LABEL, HITTING_TYPE_LABEL, percent, pitcherOf, rate } from "@/lib/gameday";
import { lineupSeason, loadGamedayRoster, loadLineup } from "@/lib/gameday-data";
import { loadCoachingStaff } from "@/lib/practice-plans";
import { ShareButton } from "../../plans/[planId]/share-button";
import { deleteLineup, reopenLineup, shareLineup } from "../actions";
import { LineupBuilder } from "./builder";
import type { DepthChart, DepthPosition } from "@/lib/playbook";

export const metadata: Metadata = { title: "Lineup · GameDay · GGG.Cafe" };

export default function LineupPage({ params, searchParams }: PageProps<"/dugout/gameday/[lineupId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <LineupView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LineupView({ params, searchParams }: Pick<PageProps<"/dugout/gameday/[lineupId]">, "params" | "searchParams">) {
  const user = await requireHeadCoachPage();
  const editor = canEdit(user.staff.role);
  const { lineupId } = await params;
  const { shared } = await searchParams;
  if (!isUuid(lineupId)) notFound();
  const supabase = await createClient();
  const lineup = await loadLineup(supabase, lineupId);
  if (!lineup) notFound();
  const seasonId = await lineupSeason(supabase, lineup.team.id, lineup.season_id);
  const [roster, staff, depthResult] = await Promise.all([
    seasonId ? loadGamedayRoster(supabase, lineup.team.id, seasonId) : Promise.resolve([]),
    editor ? loadCoachingStaff(supabase) : Promise.resolve([]),
    supabase.from("depth_chart").select("position, player_id").eq("team_id", lineup.team.id).order("rank"),
  ]);
  const depth: DepthChart = {};
  for (const r of (depthResult.data ?? []) as { position: DepthPosition; player_id: string }[]) (depth[r.position] ??= []).push(r.player_id);
  const byId = new Map(roster.map((p) => [p.id, p]));
  const rotations = Array.from({ length: lineup.rotations }, (_, i) => String(i + 1));
  const n = Number(shared);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dugout/gameday?team=${lineup.team.id}`} className="text-sm text-muted hover:text-ink">
        ← GameDay · {lineup.team.name}
      </Link>
      {typeof shared === "string" && lineup.status === "final" && (
        <p role="status" className="rounded-xl border border-neon/60 bg-neon/10 px-4 py-3 text-sm font-semibold">
          {shared === "app" ? "Your email app opened with the lineup. Hit send there to share it." : `Emailed to ${n} coach${n === 1 ? "" : "es"} with the PDF attached.`}
        </p>
      )}
      {editor && lineup.status === "draft" ? (
        <LineupBuilder lineup={lineup} roster={roster} staff={staff} emailReady={emailConfigured()} depth={depth} />
      ) : (
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-4 rounded-2xl border border-navy-700 bg-navy-900/70 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">{lineup.team.name} · Lineup</p>
                <h2 className="mt-1 text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">
                  {lineup.opponent ? `vs ${lineup.opponent}` : formatLongDate(lineup.game_date)}
                </h2>
                <p className="mt-1 text-sm text-muted">{[formatLongDate(lineup.game_date), lineup.title].filter(Boolean).join(" · ")}</p>
              </div>
              <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${lineup.status === "final" ? "bg-neon text-on-accent" : "border border-pink text-pink-soft"}`}>
                {lineup.status === "final" ? (lineup.shared_at ? "Final · Shared" : "Final") : "Draft"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a href={`/dugout/gameday/${lineup.id}/pdf`} target="_blank" rel="noopener" className={pillButtonClass}>
                Print / PDF
              </a>
              {editor && lineup.status === "final" && (
                <ShareButton
                  planId={lineup.id}
                  action={shareLineup}
                  returnPath={`/dugout/gameday/${lineup.id}`}
                  staff={staff}
                  label={lineup.shared_at ? "Share again" : "Share"}
                  className={pillOutlineClass}
                  emailReady={emailConfigured()}
                />
              )}
              {editor && lineup.status === "final" && (
                <form action={reopenLineup}>
                  <input type="hidden" name="id" value={lineup.id} />
                  <button type="submit" className={pillQuietClass}>
                    Reopen to edit
                  </button>
                </form>
              )}
              {editor && (
                <form action={deleteLineup} className="ml-auto">
                  <input type="hidden" name="id" value={lineup.id} />
                  <input type="hidden" name="team_id" value={lineup.team.id} />
                  <ConfirmSubmit message="Delete this lineup? This can't be undone." className="text-xs text-danger hover:underline">
                    Delete lineup
                  </ConfirmSubmit>
                </form>
              )}
            </div>
          </header>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Batting order">
              <ol className="flex flex-col divide-y divide-navy-800">
                {lineup.batting_order.map((id, i) => {
                  const p = byId.get(id);
                  return (
                    <li key={id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-6 font-display text-lg font-bold text-highlight tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{p?.short ?? "Player"}</span>
                        <span className="ml-2 text-xs text-muted">
                          {[p?.hitting_type && HITTING_TYPE_LABEL[p.hitting_type], p?.base_running && BASE_RUNNING_LABEL[p.base_running]].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="font-display text-xs text-muted tabular-nums">
                        {rate(p?.avg)} / {rate(p?.obp)} · K {percent(p?.k_pct)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
            <Card title="Pitching plan">
              <ul className="flex flex-col gap-2 text-sm">
                {rotations.map((r) => {
                  const pitcher = pitcherOf(lineup.defense[r]);
                  const plan = lineup.pitching[r];
                  return (
                    <li key={r}>
                      <span className="font-display font-bold text-highlight">R{r}</span>{" "}
                      <span className="font-semibold">{pitcher ? byId.get(pitcher)?.short : "–"}</span>
                      <span className="ml-2 text-muted">{[plan?.primary, plan?.secondary, ...(plan?.chase ?? [])].filter(Boolean).join(" · ")}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
          <Card title="Defensive rotations">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-navy-700 text-[0.75rem] leading-4 font-semibold tracking-wider text-muted uppercase">
                    <th className="py-2 pr-3">Player</th>
                    {rotations.map((r) => (
                      <th key={r} className="px-2 py-2 text-center">
                        R{r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...lineup.batting_order, ...roster.map((p) => p.id).filter((id) => !lineup.batting_order.includes(id))].map((id) => (
                    <tr key={id} className="border-b border-navy-800">
                      <td className="py-1.5 pr-3 font-semibold">{byId.get(id)?.short ?? "Player"}</td>
                      {rotations.map((r) => {
                        const spot = lineup.defense[r]?.[id];
                        return (
                          <td key={r} className={`px-2 py-1.5 text-center font-display ${spot === "P" ? "font-bold text-pink-soft" : spot === "Sub" ? "text-muted" : ""}`}>
                            {spot ?? "–"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {lineup.notes && (
            <Card title="Notes">
              <p className="text-sm whitespace-pre-line">{lineup.notes}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
