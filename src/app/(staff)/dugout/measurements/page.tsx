import type { Metadata } from "next";
import Link from "next/link";
import { dugoutCanEdit, requireDugoutPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { PillNav } from "@/components/pill-nav";
import { EmptyState, TableScroll, fieldClass, tableClass, tdClass, thClass } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import { CATCHER_MEASUREMENT, DEFAULT_MEASUREMENTS, PITCHER_MEASUREMENT, formatMeasure, type MeasureDef } from "@/lib/measurements";
import { loadRoster } from "@/lib/roster";
import { loadDugoutTeam } from "../data";
import { NoOwnTeam, TeamPicker } from "../team-picker";
import { recordMeasurements, removeMeasurement } from "./actions";

export const metadata: Metadata = { title: "Measurements · Coaches Dugout · GGG.Cafe" };

const heading = "font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

// Team measurements (user, 2026-11-12): one measurement for the whole roster at once (a testing
// day, a radar gun at practice). Coaches and the team's team admin enter them; each value shows
// on that player's Pop Report, in the season its date falls in.
export default async function TeamMeasurementsPage({ searchParams }: PageProps<"/dugout/measurements">) {
  const access = await requireDugoutPage("measurements");
  const editor = dugoutCanEdit(access, "measurements");
  const teamAdmin = access.role === null;
  const { team: teamParam, metric: metricParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam, access.adminTeamIds);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;

  const [{ data: metricRows }, { data: chosen }, roster] = await Promise.all([
    supabase.from("metrics").select("key, name, unit").order("name"),
    supabase.from("team_measurements").select("metric_key").eq("team_id", team.id).order("position"),
    loadRoster(supabase, team.id, { order: "name", teamAdmin }),
  ]);
  const named = new Map((metricRows ?? []).map((m) => [m.key, m]));
  // the team's list: every player's, pitchers' and catchers', then the team's extras
  const list: MeasureDef[] = [...DEFAULT_MEASUREMENTS, PITCHER_MEASUREMENT, CATCHER_MEASUREMENT];
  for (const { metric_key } of chosen ?? []) {
    const m = named.get(metric_key);
    if (m && !list.some((d) => d.key === m.key)) list.push({ key: m.key, name: m.name, unit: m.unit, better: "higher" });
  }
  const metric = list.find((m) => m.key === metricParam) ?? list[0];

  const { data: valueRows } = roster.length
    ? await supabase
        .from("measurements")
        .select("id, player_id, value, measured_on")
        .eq("metric_key", metric.key)
        .in(
          "player_id",
          roster.map((p) => p.id),
        )
        .order("measured_on", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: [] };
  const latest = new Map<string, { id: string; value: number; measured_on: string }>();
  for (const v of valueRows ?? []) if (!latest.has(v.player_id)) latest.set(v.player_id, { id: v.id, value: Number(v.value), measured_on: v.measured_on });

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/measurements" />
      <div className="max-w-3xl">
        <h2 className="text-2xl leading-tight font-bold tracking-wide text-highlight uppercase sm:text-3xl">Team measurements</h2>
        <p className="mt-2 text-sm text-muted">
          Pick a measurement, then enter a number for each player you measured. Each one shows on that player&apos;s Pop Report, in the season its
          date falls in.
          {!teamAdmin && (
            <>
              {" "}
              The team&apos;s list is set in{" "}
              <Link href={`/dugout/training/measurements?team=${team.id}`} className="text-link hover:underline">
                Training → Measurements
              </Link>
              .
            </>
          )}
        </p>
      </div>

      <PillNav
        label="Measurement"
        current={metric.key}
        items={list.map((m) => ({ key: m.key, label: m.name, href: `/dugout/measurements?team=${team.id}&metric=${m.key}` }))}
      />

      {roster.length === 0 ? (
        <EmptyState>No one on the current roster yet.</EmptyState>
      ) : (
        <section className="flex flex-col gap-3">
          <h3 className={heading}>
            {metric.name}
            {metric.unit !== "score" ? ` (${metric.unit})` : ""}
          </h3>
          <ActionForm action={recordMeasurements} id="measure-form" className="flex flex-col gap-4">
            <input type="hidden" name="team_id" value={team.id} />
            <input type="hidden" name="metric_key" value={metric.key} />
            {editor && (
              <label className="flex flex-wrap items-center gap-3 text-sm font-medium">
                Date measured
                <input type="date" name="measured_on" defaultValue={todayISO()} max={todayISO()} className={`${fieldClass} w-44`} />
              </label>
            )}
            <TableScroll label={`${team.name} ${metric.name}`}>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Player</th>
                    <th className={thClass}>Latest</th>
                    {editor && <th className={thClass}>New value</th>}
                  </tr>
                </thead>
                <tbody>
                  {roster.map((p) => {
                    const last = latest.get(p.id);
                    return (
                      <tr key={p.id}>
                        <td className={tdClass}>
                          {p.number && <span className="mr-2 font-display text-muted tabular-nums">#{p.number}</span>}
                          {p.name}
                        </td>
                        <td className={`${tdClass} font-display tabular-nums`}>
                          {last ? (
                            <span className="flex flex-wrap items-center gap-x-3">
                              <span>{formatMeasure(last.value, metric.unit)}</span>
                              <span className="font-sans text-xs text-muted">{formatDay(last.measured_on)}</span>
                              {editor && (
                                <button
                                  type="submit"
                                  form={`remove-${last.id}`}
                                  className="font-sans text-xs text-muted hover:text-danger"
                                  aria-label={`Remove ${p.name}'s ${metric.name} from ${formatDay(last.measured_on)}`}
                                >
                                  Remove
                                </button>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted">–</span>
                          )}
                        </td>
                        {editor && (
                          <td className={tdClass}>
                            <input
                              name={`value_${p.id}`}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={`${p.name}: ${metric.name}`}
                              className={`${fieldClass} w-28 font-display tabular-nums`}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
            {editor && (
              <div>
                <SubmitButton>Save {metric.name.toLowerCase()}</SubmitButton>
              </div>
            )}
          </ActionForm>
          {/* one small form per Remove button (forms can't nest inside the table's form) */}
          {editor &&
            [...latest.values()].map((v) => (
              <ActionForm key={v.id} action={removeMeasurement} id={`remove-${v.id}`}>
                <input type="hidden" name="id" value={v.id} />
              </ActionForm>
            ))}
        </section>
      )}
    </div>
  );
}
