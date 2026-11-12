import type { Metadata } from "next";
import { dugoutCanEdit, requireDugoutPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, buttonClass, inputClass } from "@/components/ui";
import { loadGamedayRoster } from "@/lib/gameday-data";
import { seasonOrCurrent } from "@/lib/roster";
import { DEPTH_POSITIONS } from "@/lib/playbook";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { GamedayNav } from "../nav";
import { addToDepth, fillDepthFromPositions, moveInDepth, removeFromDepth } from "../actions";
import { ActionForm } from "@/components/action-form";

export const metadata: Metadata = { title: "Depth Chart · GameDay · GGG.Cafe" };

const iconButton = "inline-grid min-h-6 min-w-6 place-items-center rounded px-1.5 text-muted hover:text-ink disabled:opacity-30";

export default async function DepthChartPage({ searchParams }: PageProps<"/dugout/gameday/depth">) {
  const access = await requireDugoutPage("gameday");
  const editor = dugoutCanEdit(access, "gameday");
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam, access.adminTeamIds);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const seasonId = await seasonOrCurrent(supabase, team.id, null);
  const [roster, depthResult] = await Promise.all([
    seasonId ? loadGamedayRoster(supabase, team.id, seasonId, { teamAdmin: access.role === null }) : Promise.resolve([]),
    supabase.from("depth_chart").select("position, player_id, rank").eq("team_id", team.id).order("rank"),
  ]);
  const byId = new Map(roster.map((p) => [p.id, p]));
  // players who left the roster drop off the chart (their rows stay until removed)
  const rows = ((depthResult.data ?? []) as { position: string; player_id: string; rank: number }[]).filter((r) => byId.has(r.player_id));
  const fields = (extra: Record<string, string>) =>
    Object.entries({ team_id: team.id, ...extra }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/gameday/depth" />
      <GamedayNav current="depth" teamId={team.id} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl leading-tight font-bold tracking-tight text-highlight uppercase">Depth chart</h2>
          <p className="mt-1 text-sm text-muted">Who plays where, best first. The lineup builder fills a rotation from it (&ldquo;Depth chart&rdquo; under each rotation).</p>
        </div>
        {editor && roster.length > 0 && (
          <ActionForm action={fillDepthFromPositions}>
            {fields({})}
            <button type="submit" className={buttonClass}>
              {rows.length ? "Add anyone missing from their positions" : "Start from player positions"}
            </button>
          </ActionForm>
        )}
      </div>
      {roster.length === 0 ? (
        <EmptyState>No roster for this season yet.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEPTH_POSITIONS.map((pos) => {
            const list = rows.filter((r) => r.position === pos);
            const others = roster.filter((p) => !list.some((r) => r.player_id === p.id));
            return (
              <section key={pos} className="rounded-2xl border border-navy-700 bg-navy-900/70 p-4">
                <h3 className="font-display text-2xl font-bold text-highlight">{pos}</h3>
                {list.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Nobody yet.</p>
                ) : (
                  <ol className="mt-2 flex flex-col gap-1">
                    {list.map((r, i) => (
                      <li key={r.player_id} className="flex items-center gap-2 rounded-lg border border-navy-700 px-2.5 py-1.5 text-sm">
                        <span className="w-5 font-display font-bold text-pink-soft tabular-nums">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{byId.get(r.player_id)?.short}</span>
                        {editor && (
                          <span className="flex items-center">
                            <ActionForm action={moveInDepth}>
                              {fields({ position: pos, player_id: r.player_id, dir: "up" })}
                              <button type="submit" disabled={i === 0} aria-label="Move up" className={iconButton}>
                                ↑
                              </button>
                            </ActionForm>
                            <ActionForm action={moveInDepth}>
                              {fields({ position: pos, player_id: r.player_id, dir: "down" })}
                              <button type="submit" disabled={i === list.length - 1} aria-label="Move down" className={iconButton}>
                                ↓
                              </button>
                            </ActionForm>
                            <ActionForm action={removeFromDepth}>
                              {fields({ position: pos, player_id: r.player_id })}
                              <button type="submit" aria-label="Take off the chart" className={`${iconButton} hover:text-danger`}>
                                ✕
                              </button>
                            </ActionForm>
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {editor && others.length > 0 && (
                  <ActionForm action={addToDepth} className="mt-3 flex gap-2">
                    {fields({ position: pos })}
                    <select name="player_id" required defaultValue="" aria-label={`Add a player at ${pos}`} className={`${inputClass} px-2 py-1 text-sm`}>
                      <option value="" disabled>
                        Add a player…
                      </option>
                      {others.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.short}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="shrink-0 rounded-full border border-navy-600 px-3 text-xs font-semibold hover:border-pink hover:bg-pink hover:text-on-accent">
                      Add
                    </button>
                  </ActionForm>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
