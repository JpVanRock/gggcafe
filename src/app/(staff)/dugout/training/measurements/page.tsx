import type { Metadata } from "next";
import Link from "next/link";
import { canEdit, isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { BUILT_IN_KEYS, CATCHER_MEASUREMENT, DEFAULT_MEASUREMENTS, PITCHER_MEASUREMENT, SEASONS, TEAM_EXTRA_MAX } from "@/lib/measurements";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { TrainingNav } from "../nav";
import { saveTeamMeasurements } from "../actions";

export const metadata: Metadata = { title: "Measurements · Training · Coaches Dugout · GGG.Cafe" };

// The team's measurement list (user, 2026-11-10): every player's POP Report shows the
// built-in list by season; coaches add more here for their team.
const heading = "font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

export default async function MeasurementsSettingsPage({ searchParams }: PageProps<"/dugout/training/measurements">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const [{ data: metrics }, { data: chosen }] = await Promise.all([
    supabase.from("metrics").select("key, name, unit").order("name"),
    supabase.from("team_measurements").select("metric_key").eq("team_id", team.id).order("position"),
  ]);
  const extras = ((metrics ?? []) as { key: string; name: string; unit: string }[]).filter((m) => !BUILT_IN_KEYS.includes(m.key));
  const on = new Set(((chosen ?? []) as { metric_key: string }[]).map((c) => c.metric_key));

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/training/measurements" />
      <TrainingNav current="measurements" teamId={team.id} head={isHeadCoach(user.staff.role)} />

      <section className="flex flex-col gap-3">
        <h2 className={heading}>Every player&apos;s list</h2>
        <p className="text-sm text-muted">
          Her POP Report shows these in four columns: {SEASONS.map((s) => s.name).join(", ")}. The date measured picks the season. Coaches enter
          values on her POP Report, or for the whole roster at once on{" "}
          <Link href={`/dugout/measurements?team=${team.id}`} className="text-link hover:underline">
            Team measurements
          </Link>
          ; Testing results land there too.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DEFAULT_MEASUREMENTS.map((m) => (
            <li key={m.key} className="rounded-lg border border-navy-700 px-3 py-2 text-sm">
              <span className="font-semibold">{m.name}</span>
              {m.unit !== "score" && <span className="text-muted"> ({m.unit})</span>}
            </li>
          ))}
          <li className="rounded-lg border border-navy-700 px-3 py-2 text-sm">
            <span className="font-semibold">{PITCHER_MEASUREMENT.name}</span> <span className="text-muted">· pitchers</span>
          </li>
          <li className="rounded-lg border border-navy-700 px-3 py-2 text-sm">
            <span className="font-semibold">{CATCHER_MEASUREMENT.name}</span> <span className="text-muted">· catchers</span>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={heading}>Add for {team.name}</h2>
        <p className="text-sm text-muted">Tick any others you want on every {team.name} player&apos;s POP Report (up to {TEAM_EXTRA_MAX}).</p>
        <ActionForm action={saveTeamMeasurements} className="flex flex-col gap-4">
          <input type="hidden" name="team_id" value={team.id} />
          <fieldset disabled={!editor} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="sr-only">Extra measurements</legend>
            {extras.map((m) => (
              <label key={m.key} className="flex items-center gap-2 rounded-lg border border-navy-700 px-3 py-2 text-sm hover:border-pink">
                <input type="checkbox" name="metric" value={m.key} defaultChecked={on.has(m.key)} className="size-4 accent-pink" />
                <span>
                  {m.name}
                  {m.unit !== "score" && <span className="text-muted"> ({m.unit})</span>}
                </span>
              </label>
            ))}
          </fieldset>
          {editor && (
            <div>
              <SubmitButton>Save the list</SubmitButton>
            </div>
          )}
        </ActionForm>
      </section>
    </div>
  );
}
