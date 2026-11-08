import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canEdit, isHeadCoach, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Disclosure, EmptyState, Loading } from "@/components/ui";
import { INTENT_LABEL, type ScriptPitch } from "@/lib/bullpen";
import { loadOwnTeams } from "../../data";
import { TeamPicker } from "../../team-picker";
import { TrainingNav } from "../nav";
import { deleteBullpenScript } from "../actions";
import { BullpenBuilder } from "../bullpen-builder";

export const metadata: Metadata = { title: "Bullpens · Training · Coaches Dugout · GGG.Cafe" };

// Scripted bullpens (Phase 4): the team's scripts. Pitchers throw them from their
// Performance Training page (or a team routine in TWIS) and tap hit or miss.
export default function BullpensPage({ searchParams }: PageProps<"/dugout/training/bullpens">) {
  return (
    <Suspense fallback={<Loading />}>
      <Bullpens searchParams={searchParams} />
    </Suspense>
  );
}

type Script = { id: string; name: string; notes: string | null; pitches: ScriptPitch[] };

async function Bullpens({ searchParams }: Pick<PageProps<"/dugout/training/bullpens">, "searchParams">) {
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
  const team = teams.find((t) => t.id === teamParam) ?? teams[0];
  const { data } = await supabase.from("bullpen_scripts").select("id, name, notes, pitches").eq("team_id", team.id).order("name");
  const scripts = (data ?? []) as Script[];

  return (
    <div className="flex flex-col gap-8">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/training/bullpens" />
      <TrainingNav current="bullpens" teamId={team.id} head={isHeadCoach(user.staff.role)} />
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Bullpen scripts</h2>
        <p className="text-sm text-muted">
          Pitch by pitch: type, target zone (catcher&apos;s view), intent and count. Pitchers throw them from Performance Training and tap hit or
          miss on each pitch; command % by pitch type builds over the weeks. Push one as a pitching team routine to put it in TWIS.
        </p>
        {editor && (
          <Disclosure summary="Write a script" open={scripts.length === 0}>
            <BullpenBuilder teamId={team.id} />
          </Disclosure>
        )}
        {scripts.length === 0 ? (
          <EmptyState>No scripts yet.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {scripts.map((s) => (
              <li key={s.id} className="rounded-xl border border-navy-700 bg-navy-900/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold tracking-wide uppercase">{s.name}</p>
                    <p className="text-xs text-muted">
                      {s.pitches.length} pitches · {[...new Set(s.pitches.map((p) => p.pitch))].join(", ")}
                    </p>
                    {s.notes && <p className="mt-1 text-sm text-ink/90">{s.notes}</p>}
                  </div>
                  {editor && (
                    <form action={deleteBullpenScript}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmSubmit message={`Remove "${s.name}"? Sessions already thrown stay.`} className="text-xs text-danger hover:underline">
                        Remove
                      </ConfirmSubmit>
                    </form>
                  )}
                </div>
                <ol className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {s.pitches.map((p, i) => (
                    <li key={i} className="rounded border border-navy-700 px-1.5 py-0.5" title={`${INTENT_LABEL[p.intent]}${p.count ? ` · ${p.count}` : ""}`}>
                      {p.pitch} {p.zone}
                      {p.count ? ` · ${p.count}` : ""}
                    </li>
                  ))}
                </ol>
                {editor && (
                  <div className="mt-3">
                    <Disclosure summary="Edit">
                      <BullpenBuilder teamId={team.id} script={s} />
                    </Disclosure>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
