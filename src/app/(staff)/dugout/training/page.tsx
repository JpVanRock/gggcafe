import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Disclosure, EmptyState, Loading } from "@/components/ui";
import { WEEKDAYS, formatDay, todayISO } from "@/lib/dates";
import { TRAINING_CATEGORY_LABEL } from "@/lib/achievements";
import { PHASE_INFO, overlaps, phaseOn, phaseWeek } from "@/lib/training-plan";
import { loadOwnTeams } from "../data";
import { TeamPicker, pickTeam } from "../team-picker";
import { TrainingNav } from "./nav";
import { loadRoadmap } from "./data";
import { deletePhase, deleteTeamRoutine, endTeamRoutine } from "./actions";
import { PhaseForm, SuggestForm, TeamRoutineForm } from "./forms";

export const metadata: Metadata = { title: "Training · Coaches Dugout · GGG.Cafe" };

// Coaches Dugout → Training (SB Blueprint Phase 2): the season roadmap, planned
// backward from the championship, and team routines pushed to every player.
export default function TrainingPage({ searchParams }: PageProps<"/dugout/training">) {
  return (
    <Suspense fallback={<Loading />}>
      <Training searchParams={searchParams} />
    </Suspense>
  );
}

const heading = "font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase";
const KIND_COLOR: Record<string, string> = {
  testing: "bg-pink",
  build: "bg-navy-600",
  sport: "bg-neon",
  preseason: "bg-pink-soft",
  inseason: "bg-highlight",
  recovery: "bg-muted",
};

async function Training({ searchParams }: Pick<PageProps<"/dugout/training">, "searchParams">) {
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
  const team = pickTeam(teams, teamParam);
  const today = todayISO();
  const [{ phases, routines, library, scripts }, offseason, nextGame] = await Promise.all([
    loadRoadmap(supabase, team.id),
    supabase.from("team_offseason").select("starts_on").eq("team_id", team.id).maybeSingle(),
    supabase
      .from("games")
      .select("game_date")
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .gte("game_date", today)
      .order("game_date")
      .limit(1)
      .maybeSingle(),
  ]);
  const now = phaseOn(phases, today);
  const span = phases.length ? { from: phases[0].starts_on, to: phases.reduce((m, p) => (p.ends_on > m ? p.ends_on : m), phases[0].ends_on) } : null;
  const total = span ? Math.max(1, (Date.parse(span.to) - Date.parse(span.from)) / 86_400_000 + 1) : 1;
  const pos = (d: string) => (span ? ((Date.parse(d) - Date.parse(span.from)) / 86_400_000 / total) * 100 : 0);
  const clash = overlaps(phases);
  const phaseName = new Map(phases.map((p) => [p.id, p.name]));
  const current = routines.filter((r) => r.starts_on <= today && (!r.ends_on || r.ends_on >= today));
  const upcoming = routines.filter((r) => r.starts_on > today);
  const ended = routines.filter((r) => r.ends_on && r.ends_on < today);

  const routineCard = (r: (typeof routines)[number], live: boolean) => (
    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-navy-700 bg-navy-900/60 p-4">
      <div className="min-w-0">
        <p className="font-semibold">{r.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {TRAINING_CATEGORY_LABEL[r.category].title} · {r.days.length ? r.days.map((d) => WEEKDAYS[d - 1].short).join(", ") : "Once a week"} ·{" "}
          {r.ends_on ? `${formatDay(r.starts_on)} – ${formatDay(r.ends_on)}` : `From ${formatDay(r.starts_on)}`}
          {r.phase_id && phaseName.get(r.phase_id) ? ` · ${phaseName.get(r.phase_id)}` : ""}
        </p>
        {r.details && <p className="mt-1 text-sm text-ink/90">{r.details}</p>}
        <p className="mt-1 font-mono text-[11px] tracking-wider text-pink-soft uppercase">On {r.copies[0]?.count ?? 0} players</p>
      </div>
      {editor && (
        <div className="flex items-center gap-3">
          {live && (
            <form action={endTeamRoutine}>
              <input type="hidden" name="id" value={r.id} />
              <ConfirmSubmit message={`End "${r.title}" for every player today? Their check-offs stay.`} className="text-xs text-muted hover:text-ink">
                End now
              </ConfirmSubmit>
            </form>
          )}
          <form action={deleteTeamRoutine}>
            <input type="hidden" name="id" value={r.id} />
            <ConfirmSubmit message={`Remove "${r.title}"? Players' copies end today and keep their check-offs.`} className="text-xs text-danger hover:underline">
              Remove
            </ConfirmSubmit>
          </form>
        </div>
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/training" />
      <TrainingNav current="roadmap" teamId={team.id} head={isHeadCoach(user.staff.role)} />

      {/* Roadmap ----------------------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={heading}>Season roadmap</h2>
            <p className="mt-1 text-sm text-muted">Players see the phase and the week in TWIS, with its focus.</p>
          </div>
          {now && (
            <p className="rounded-full border border-neon px-3 py-1 font-mono text-xs font-bold tracking-wider text-highlight uppercase">
              Now: {now.name} · Week {phaseWeek(now, today).week} of {phaseWeek(now, today).of}
            </p>
          )}
        </div>

        {phases.length > 0 && span ? (
          <>
            <div className="relative h-10 overflow-hidden rounded-lg border border-navy-700 bg-navy-950" aria-hidden>
              {phases.map((p) => (
                <span
                  key={p.id}
                  className={`absolute inset-y-0 ${KIND_COLOR[p.kind]} opacity-80`}
                  style={{ left: `${pos(p.starts_on)}%`, width: `${Math.max(0.6, pos(p.ends_on) - pos(p.starts_on) + 100 / total)}%` }}
                  title={p.name}
                />
              ))}
              {today >= span.from && today <= span.to && <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${pos(today)}%` }} />}
            </div>
            {clash.length > 0 && (
              <p className="text-sm text-pink-soft">
                Overlapping phases: {clash.map(([a, b]) => `${a} and ${b}`).join("; ")}. TWIS shows the later one.
              </p>
            )}
            <ol className="flex flex-col gap-2">
              {phases.map((p) => {
                const weeks = phaseWeek(p, p.ends_on).of;
                return (
                  <li key={p.id} className={`rounded-xl border p-3 ${now?.id === p.id ? "border-neon" : "border-navy-700"}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span aria-hidden className={`size-3 rounded-sm ${KIND_COLOR[p.kind]}`} />
                      <span className="font-display text-lg font-bold tracking-wide uppercase">{p.name}</span>
                      <span className="text-sm text-muted">
                        {formatDay(p.starts_on)} – {formatDay(p.ends_on)} · {weeks} week{weeks === 1 ? "" : "s"} · {PHASE_INFO[p.kind].label}
                      </span>
                      {editor && (
                        <form action={deletePhase} className="ml-auto">
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmSubmit message={`Remove the ${p.name} phase? Team routines in it stay.`} className="text-xs text-muted hover:text-danger">
                            Remove
                          </ConfirmSubmit>
                        </form>
                      )}
                    </div>
                    {p.focus && <p className="mt-1 text-sm text-ink/90">{p.focus}</p>}
                    {editor && (
                      <div className="mt-2">
                        <Disclosure summary="Edit">
                          <PhaseForm teamId={team.id} phase={p} />
                        </Disclosure>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <EmptyState>No roadmap yet.{editor && " Plan one backward from the championship below."}</EmptyState>
        )}

        {editor && (
          <div className="flex flex-col gap-2">
            <Disclosure summary="Plan it backward from the championship" open={phases.length === 0}>
              <SuggestForm teamId={team.id} start={(offseason.data as { starts_on: string } | null)?.starts_on ?? today} firstGame={(nextGame.data as { game_date: string } | null)?.game_date ?? null} hasPhases={phases.length > 0} />
            </Disclosure>
            <Disclosure summary="Add a phase">
              <PhaseForm teamId={team.id} />
            </Disclosure>
          </div>
        )}
      </section>

      {/* Team routines ------------------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className={heading}>Team routines</h2>
          <p className="mt-1 text-sm text-muted">
            Pushed to every player on the current roster (new players get them too). They show in TWIS; players check them off but
            can&apos;t change or remove them.
          </p>
        </div>
        {editor && (
          <Disclosure summary="Push a routine to the team" open={routines.length === 0}>
            <TeamRoutineForm teamId={team.id} phases={phases} library={library} scripts={scripts} today={today} />
          </Disclosure>
        )}
        {current.length > 0 && <ul className="grid gap-3 md:grid-cols-2">{current.map((r) => routineCard(r, true))}</ul>}
        {upcoming.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-muted">Starting later</h3>
            <ul className="grid gap-3 md:grid-cols-2">{upcoming.map((r) => routineCard(r, true))}</ul>
          </>
        )}
        {routines.length === 0 && <EmptyState>No team routines yet.</EmptyState>}
        {ended.length > 0 && (
          <Disclosure summary={`Ended (${ended.length})`}>
            <ul className="grid gap-3 md:grid-cols-2">{ended.map((r) => routineCard(r, false))}</ul>
          </Disclosure>
        )}
      </section>
    </div>
  );
}
