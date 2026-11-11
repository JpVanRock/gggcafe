// Measurements on her POP Report (user, 2026-11-10): her list (the defaults, fastball speed
// for pitchers, pop time for catchers, her team's extras) in four seasons for the softball
// year, plus her best. Coaches add values here; the date decides the season.
import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import { TableScroll, tableClass, tdClass, thClass } from "@/components/ui";
import { DetailHeading } from "./menu";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatLongDate, todayISO } from "@/lib/dates";
import {
  SEASONS, bestOf, formatMeasure, measurementsFor, seasonGrid, seasonLabel, seasonOf, softballYear, yearLabel, yearsWithData,
  type MeasureDef, type MeasurementRow,
} from "@/lib/measurements";
import { deleteMeasurement } from "./measurement-actions";
import { MeasurementForm } from "./measurements-client";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MeasurementsData = { defs: MeasureDef[]; rows: MeasurementRow[] };

/** Her measurements and the list to show them in. `teamId`: her current own team, for its extras. */
export async function loadMeasurements(
  supabase: Supabase,
  player: { id: string; primary_position: string | null; secondary_positions: string[] | null },
  teamId: string | null,
): Promise<MeasurementsData> {
  const [{ data: rows }, { data: extras }, { data: metrics }] = await Promise.all([
    supabase.from("measurements").select("id, metric_key, value, measured_on, created_at").eq("player_id", player.id),
    teamId ? supabase.from("team_measurements").select("metric_key").eq("team_id", teamId).order("position") : Promise.resolve({ data: [] }),
    supabase.from("metrics").select("key, name, unit, better"),
  ]);
  const measured = (rows ?? []) as MeasurementRow[];
  const all = ((metrics ?? []) as { key: string; name: string; unit: string; better: string }[]).map((m) => ({
    key: m.key,
    name: m.name,
    unit: m.unit,
    better: m.better === "lower" ? ("lower" as const) : ("higher" as const),
  }));
  const defs = measurementsFor(
    [player.primary_position, ...(player.secondary_positions ?? [])],
    ((extras ?? []) as { metric_key: string }[]).map((e) => e.metric_key),
    [...new Set(measured.map((r) => r.metric_key))],
    all,
  );
  return { defs, rows: measured.map((r) => ({ ...r, value: Number(r.value) })) };
}

export function MeasurementsBySeason({
  playerId,
  data,
  year: asked,
  basePath,
  canEdit,
}: {
  playerId: string;
  data: MeasurementsData;
  /** the softball year to show (its starting year); the current one when not given */
  year?: number | null;
  /** the page's path, for the year links */
  basePath: string;
  canEdit: boolean;
}) {
  const today = todayISO();
  const current = softballYear(today);
  const years = yearsWithData(data.rows, current);
  const year = asked && years.includes(asked) ? asked : current;
  const grid = seasonGrid(data.rows, year);
  const entries = data.rows
    .filter((r) => softballYear(r.measured_on) === year)
    .sort((a, b) => b.measured_on.localeCompare(a.measured_on) || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const nameOf = (key: string) => data.defs.find((d) => d.key === key);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DetailHeading>Measurements · {yearLabel(year)}</DetailHeading>
        {years.length > 1 && (
          <nav aria-label="Softball year" className="flex flex-wrap gap-2">
            {years.map((y) => (
              <Link
                key={y}
                href={`${basePath}?year=${y}`}
                aria-current={y === year ? "page" : undefined}
                className={`rounded-full border px-3 py-1 font-mono text-2xs tracking-wider ${y === year ? "border-pink text-ink" : "border-navy-600 text-muted hover:border-pink"}`}
              >
                {yearLabel(y)}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <TableScroll label="Measurements by season">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Measurement</th>
              {SEASONS.map((s) => (
                <th key={s.key} className={thClass}>
                  {s.name}
                </th>
              ))}
              <th className={thClass}>Best</th>
            </tr>
          </thead>
          <tbody>
            {data.defs.map((d) => {
              const cells = grid.get(d.key) ?? {};
              const best = bestOf(data.rows, d);
              return (
                <tr key={d.key}>
                  <td className={`${tdClass} font-semibold`}>{d.name}</td>
                  {SEASONS.map((s) => {
                    const c = cells[s.key];
                    return (
                      <td key={s.key} className={`${tdClass} font-display whitespace-nowrap tabular-nums`} title={c ? formatLongDate(c.measured_on) : undefined}>
                        {c ? formatMeasure(c.value, d.unit) : <span className="text-muted">–</span>}
                      </td>
                    );
                  })}
                  <td className={`${tdClass} font-display whitespace-nowrap tabular-nums ${best ? "text-highlight" : ""}`}>
                    {best ? formatMeasure(best.value, d.unit) : <span className="text-muted">–</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
      <p className="mt-2 text-xs text-muted">
        Fall Season: September to November · Winter Offseason: December to February · Spring Season: March to May · Summer Season: June to August.
        Each season shows the latest value.
      </p>

      {canEdit && (
        <div className="mt-4 flex flex-col gap-4">
          <MeasurementForm
            playerId={playerId}
            options={data.defs.map((d) => ({ key: d.key, name: d.name, unit: d.unit }))}
            today={today}
            todaySeason={seasonLabel(seasonOf(today), current)}
          />
          {entries.length > 0 && (
            <details className="rounded-lg border border-navy-700 px-3 py-2">
              <summary className="cursor-pointer text-sm">Entries in {yearLabel(year)} ({entries.length})</summary>
              <ul className="mt-2 divide-y divide-navy-700">
                {entries.map((r) => {
                  const def = nameOf(r.metric_key);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                      <span>
                        {def?.name ?? r.metric_key}: <span className="font-display tabular-nums">{formatMeasure(r.value, def?.unit ?? "")}</span>
                        <span className="text-muted"> · {formatLongDate(r.measured_on)} · {seasonLabel(seasonOf(r.measured_on), year)}</span>
                      </span>
                      <ActionForm action={deleteMeasurement} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={r.id} />
                        <ConfirmSubmit message="Remove this measurement?" className="text-xs text-muted underline hover:text-danger">
                          Remove
                        </ConfirmSubmit>
                      </ActionForm>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
