import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Disclosure, EmptyState, Loading } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { INSTALL_STATUS_LABEL, type InstallStatus } from "@/lib/install";
import { PLAY_CATEGORIES, PLAY_CATEGORY_LABEL } from "@/lib/playbook";
import { loadOwnTeams } from "../data";
import { TeamPicker } from "../team-picker";
import { PlaybookNav } from "./nav";
import { addPlayToInstall, removePlay } from "./actions";
import { PlayForm, type PlayRow } from "./forms";

export const metadata: Metadata = { title: "Playbook · Coaches Dugout · GGG.Cafe" };

export default function PlaybookPage({ searchParams }: PageProps<"/dugout/playbook">) {
  return (
    <Suspense fallback={<Loading />}>
      <Playbook searchParams={searchParams} />
    </Suspense>
  );
}

type Effectiveness = { play_id: string; times_called: number; successes: number };

async function Playbook({ searchParams }: Pick<PageProps<"/dugout/playbook">, "searchParams">) {
  const user = await requireStaffPage();
  const editor = canEdit(user.staff.role);
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const teams = await loadOwnTeams(supabase);
  if (teams.length === 0) return <EmptyState>Add your team on the Teams page first (mark it as one of our teams).</EmptyState>;
  const team = teams.find((t) => t.id === teamParam) ?? teams[0];

  const [playsResult, installResult, effectResult] = await Promise.all([
    supabase
      .from("playbook_plays")
      .select("id, team_id, name, category, situation, description, call_sheet")
      .or(`team_id.eq.${team.id},team_id.is.null`)
      .eq("active", true)
      .order("name"),
    supabase.from("install_items").select("play_id, status").eq("team_id", team.id).not("play_id", "is", null),
    supabase.from("play_effectiveness").select("play_id, times_called, successes"),
  ]);
  const plays = (playsResult.data ?? []) as PlayRow[];
  const installed = new Map(((installResult.data ?? []) as { play_id: string; status: InstallStatus }[]).map((i) => [i.play_id, i.status]));
  const effect = new Map(((effectResult.data ?? []) as Effectiveness[]).map((e) => [e.play_id, e]));
  const onSheet = plays.filter((p) => p.call_sheet).length;

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/playbook" />
      <PlaybookNav current="plays" teamId={team.id} />
      <p className="text-sm text-muted">
        {plays.length} play{plays.length === 1 ? "" : "s"} · {onSheet} on the call sheet {team.name} players drill as flashcards (Softball IQ → Team
        Playbook). Plays for all our teams are the organization playbook. Staff only, except the call sheet.
      </p>

      {editor && (
        <Disclosure summary="Add a play" open={plays.length === 0}>
          <PlayForm teamId={team.id} teamName={team.name} />
        </Disclosure>
      )}

      {plays.length === 0 ? (
        <EmptyState>No plays yet.{editor && " Add your first call above."}</EmptyState>
      ) : (
        PLAY_CATEGORIES.map((c) => {
          const list = plays.filter((p) => p.category === c);
          if (list.length === 0) return null;
          return (
            <section key={c}>
              <h2 className="mb-3 text-xl font-bold tracking-wide text-highlight uppercase">{PLAY_CATEGORY_LABEL[c]}</h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {list.map((p) => {
                  const status = installed.get(p.id);
                  const e = effect.get(p.id);
                  return (
                    <li key={p.id} className="rounded-2xl border border-navy-700 bg-navy-900/70 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-lg font-bold text-ink">{p.name}</h3>
                        <span className="flex flex-wrap gap-1.5">
                          {p.call_sheet && (
                            <span className="rounded bg-pink px-1.5 py-px font-mono text-[10px] font-bold tracking-wider text-on-accent uppercase">Call sheet</span>
                          )}
                          {p.team_id === null && (
                            <span className="rounded border border-navy-600 px-1.5 py-px font-mono text-[10px] font-bold tracking-wider text-muted uppercase">All teams</span>
                          )}
                        </span>
                      </div>
                      {p.situation && <p className="mt-1 text-xs text-pink-soft">{p.situation}</p>}
                      <p className="mt-2 text-sm whitespace-pre-line text-ink/90">{p.description}</p>
                      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        {status ? (
                          <Link href={`/dugout/plans/install?team=${team.id}`} className="hover:text-ink">
                            Install: <span className="font-semibold text-highlight">{INSTALL_STATUS_LABEL[status]}</span>
                          </Link>
                        ) : (
                          editor && (
                            <form action={addPlayToInstall}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="team_id" value={team.id} />
                              <button type="submit" className="font-semibold text-pink-soft hover:underline">
                                + Install checklist
                              </button>
                            </form>
                          )
                        )}
                        {e && e.times_called > 0 && (
                          <span>
                            Called {e.times_called}× · worked {Math.round((e.successes / e.times_called) * 100)}%
                          </span>
                        )}
                      </p>
                      {editor && (
                        <div className="mt-3 flex flex-wrap items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <Disclosure summary="Edit">
                              <PlayForm teamId={team.id} teamName={team.name} play={p} />
                            </Disclosure>
                          </div>
                          <form action={removePlay}>
                            <input type="hidden" name="id" value={p.id} />
                            <ConfirmSubmit message={`Remove “${p.name}” from the playbook${p.team_id === null ? " for every team" : ""}?`} className="pt-2 text-xs text-muted hover:text-danger">
                              Remove
                            </ConfirmSubmit>
                          </form>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
