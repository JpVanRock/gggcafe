import type { Metadata } from "next";
import Link from "next/link";
import { isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COACH_MODULES, modulesDone } from "@/lib/coach-training";
import { MENTAL_LESSONS, lessonsDone, twoDigits } from "@/lib/mental-lessons";
import { loadRoster } from "@/lib/roster";
import { ROLE_LABEL, type StaffRole } from "@/lib/roles";
import { OutlineText } from "@/components/athletic";
import { EmptyState, TableScroll, eyebrowClass, tableClass, tdClass, thClass } from "@/components/ui";
import { loadDugoutTeam } from "../../data";
import { NoOwnTeam, TeamPicker } from "../../team-picker";
import { TrainingNav } from "../nav";

export const metadata: Metadata = { title: "Coach training · Training · Coaches Dugout · GGG.Cafe" };

const heading = "font-mono text-2xs font-bold tracking-[0.2em] text-pink-soft uppercase";

function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <span className="flex items-center gap-3">
      <span
        className="h-2 w-28 overflow-hidden rounded-full bg-navy-700"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span className="block h-full bg-neon" style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className="font-display text-sm font-bold tabular-nums">
        {done} of {total}
      </span>
    </span>
  );
}

// Coach training, The Mental Game (user, 2026-11-12): a course for coaches, not
// players. Each coach's progress and notes are their own; admins also see the
// staff's progress. Below it, the team's progress on the players' Mental GP lessons.
export default async function CoachTrainingPage({ searchParams }: PageProps<"/dugout/training/coach">) {
  const user = await requireStaffPage();
  const admin = user.staff.role === "admin";
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const dugout = await loadDugoutTeam(supabase, teamParam);
  if (!dugout) return <NoOwnTeam />;
  const { teams, team } = dugout;
  const [mine, roster, staff, staffDone] = await Promise.all([
    supabase.from("coach_mental_lessons").select("lesson").eq("user_id", user.id).not("completed_at", "is", null),
    loadRoster(supabase, team.id, { order: "name" }),
    admin ? supabase.from("staff").select("user_id, display_name, role").order("display_name") : Promise.resolve({ data: [] }),
    admin ? supabase.from("coach_mental_lessons").select("user_id, lesson").not("completed_at", "is", null) : Promise.resolve({ data: [] }),
  ]);
  const { data: playerDone } = roster.length
    ? await supabase
        .from("player_mental_lessons")
        .select("player_id, lesson")
        .in(
          "player_id",
          roster.map((p) => p.id),
        )
        .not("completed_at", "is", null)
    : { data: [] };

  const finished = new Set(((mine.data ?? []) as { lesson: string }[]).map((r) => r.lesson));
  const myCount = modulesDone(finished);
  const doneBy = (rows: { lesson: string }[] | null, key: "player_id" | "user_id", id: string) =>
    ((rows ?? []) as ({ lesson: string } & Record<string, string>)[]).filter((r) => r[key] === id).map((r) => r.lesson);
  const q = `?team=${team.id}`;

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/training/coach" />
      <TrainingNav current="coach" teamId={team.id} head={isHeadCoach(user.staff.role)} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-2xl leading-tight font-bold tracking-wide text-highlight uppercase sm:text-3xl">Coaching the Mental Game</h2>
            <p className="mt-2 text-sm text-muted">
              A course for coaches, not players: what to say, how to build mental skills into practice, how to read your players and where a coach&apos;s
              job ends. Nine short modules, each with one thing to try this week. Players have their own lessons on their Mental GP; each module shows the
              lesson it goes with. Your notes are yours{admin ? "; as an admin you also see the staff's progress" : ""}.
            </p>
          </div>
          <Progress label="Modules you've finished" done={myCount} total={COACH_MODULES.length} />
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COACH_MODULES.map((m, i) => (
            <li key={m.slug}>
              <Link
                href={`/dugout/training/coach/${m.slug}${q}`}
                className="relative flex h-full flex-col gap-1.5 overflow-hidden rounded-2xl border border-navy-600 bg-navy-900/70 p-4 transition hover:border-pink hover:bg-navy-800"
              >
                <OutlineText className="absolute -top-1 right-2 text-5xl">{twoDigits(i + 1)}</OutlineText>
                <span className={`${eyebrowClass} relative flex flex-wrap items-center gap-2 pr-12`}>
                  <span>
                    Module {i + 1} · {m.minutes} min
                  </span>
                  {finished.has(m.slug) && <span className="rounded bg-neon px-1.5 py-px font-bold text-on-accent">Done</span>}
                </span>
                <span className="relative pr-10 font-display text-lg leading-tight font-bold tracking-wide text-highlight uppercase">{m.title}</span>
                <span className="text-sm text-muted">{m.summary}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className={heading}>{team.name} · Mental GP lessons</h2>
          <p className="mt-1 text-sm text-muted">
            How far each player is through the {MENTAL_LESSONS.length} lessons on her Mental GP. Open her Mental GP to read her answers.
          </p>
        </div>
        {roster.length === 0 ? (
          <EmptyState>No one on the current roster yet.</EmptyState>
        ) : (
          <TableScroll label={`${team.name} Mental GP lessons`}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Player</th>
                  <th className={thClass}>Lessons done</th>
                  <th className={thClass}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => (
                  <tr key={p.id}>
                    <td className={tdClass}>
                      {p.number && <span className="mr-2 font-display text-muted tabular-nums">#{p.number}</span>}
                      {p.name}
                    </td>
                    <td className={tdClass}>
                      <Progress label={`${p.name}: lessons done`} done={lessonsDone(doneBy(playerDone, "player_id", p.id))} total={MENTAL_LESSONS.length} />
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Link href={`/players/${p.id}/mental#lessons`} className="text-sm font-semibold text-link hover:underline" aria-label={`${p.name}'s Mental GP`}>
                        Mental GP <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      {admin && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className={heading}>Staff progress (admins)</h2>
            <p className="mt-1 text-sm text-muted">Who has worked through the coaches&apos; course. Only admins see this; their notes stay private.</p>
          </div>
          {(staff.data ?? []).length === 0 ? (
            <EmptyState>No staff yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-navy-800">
              {((staff.data ?? []) as { user_id: string; display_name: string; role: StaffRole }[]).map((s) => (
                <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="font-semibold">{s.display_name}</span>
                    <span className="text-sm text-muted"> · {ROLE_LABEL[s.role] ?? s.role}</span>
                  </span>
                  <Progress
                    label={`${s.display_name}: modules done`}
                    done={modulesDone(doneBy(staffDone.data as { lesson: string }[] | null, "user_id", s.user_id))}
                    total={COACH_MODULES.length}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
