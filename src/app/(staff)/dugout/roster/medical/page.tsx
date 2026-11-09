import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireHeadCoachPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Disclosure, EmptyState, Loading } from "@/components/ui";
import { MedicalForm } from "@/components/family-forms";
import { medicalOnFile } from "@/lib/family";
import { loadOwnTeams } from "../../data";
import { TeamPicker, pickTeam } from "../../team-picker";
import { loadTeamRoster } from "../../training/data";
import { saveMedicalCard } from "../actions";

export const metadata: Metadata = { title: "Medical cards · Roster · Coaches Dugout · GGG.Cafe" };

// Medical & emergency cards (Phase 6): head coaches and admins only (user, 2026-11-08);
// parents fill them in on /family. A quick view for game days.
export default function MedicalPage({ searchParams }: PageProps<"/dugout/roster/medical">) {
  return (
    <Suspense fallback={<Loading />}>
      <Medical searchParams={searchParams} />
    </Suspense>
  );
}

type Card = Record<string, string | null> & { player_id: string; updated_at: string };

async function Medical({ searchParams }: Pick<PageProps<"/dugout/roster/medical">, "searchParams">) {
  await requireHeadCoachPage();
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const teams = await loadOwnTeams(supabase);
  if (teams.length === 0) return <EmptyState>Add your team first.</EmptyState>;
  const team = pickTeam(teams, teamParam);
  const roster = await loadTeamRoster(supabase, team.id);
  const { data } = roster.length ? await supabase.from("medical_cards").select("*").in("player_id", roster.map((p) => p.id)) : { data: [] };
  const cards = new Map(((data ?? []) as Card[]).map((c) => [c.player_id, c]));
  const onFile = roster.filter((p) => medicalOnFile(cards.get(p.id) ?? null)).length;

  return (
    <div className="flex flex-col gap-6">
      <TeamPicker teams={teams} current={team.id} basePath="/dugout/roster/medical" />
      <div>
        <Link href={`/dugout/roster?team=${team.id}`} className="text-sm text-pink hover:underline">
          ← Roster
        </Link>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-highlight uppercase">Medical cards</h2>
        <p className="mt-1 text-sm text-muted">
          {onFile} of {roster.length} on file. Only head coaches and each player&apos;s parents can see these. Parents fill them in on their family page.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {roster.map((p) => {
          const c = cards.get(p.id) ?? null;
          const ok = medicalOnFile(c);
          return (
            <li key={p.id} className={`rounded-2xl border p-4 ${ok ? "border-navy-600" : "border-pink/60 bg-pink/5"}`}>
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {p.number && <span className="mr-1.5 font-display text-muted tabular-nums">#{p.number}</span>}
                  {p.name}
                </span>
                <span className={`font-mono text-[10px] font-bold tracking-wider uppercase ${ok ? "text-highlight" : "text-pink-soft"}`}>{ok ? "On file" : "Missing"}</span>
              </p>
              {c && (
                <dl className="mt-2 grid gap-1 text-sm">
                  {c.contact1_name && (
                    <div>
                      <dt className="inline text-muted">Contact: </dt>
                      <dd className="inline">
                        {c.contact1_name}
                        {c.contact1_relation ? ` (${c.contact1_relation})` : ""} · <a href={`tel:${c.contact1_phone}`} className="text-pink hover:underline">{c.contact1_phone}</a>
                      </dd>
                    </div>
                  )}
                  {c.contact2_name && (
                    <div>
                      <dt className="inline text-muted">Contact 2: </dt>
                      <dd className="inline">
                        {c.contact2_name}
                        {c.contact2_relation ? ` (${c.contact2_relation})` : ""} {c.contact2_phone && <>· <a href={`tel:${c.contact2_phone}`} className="text-pink hover:underline">{c.contact2_phone}</a></>}
                      </dd>
                    </div>
                  )}
                  {(["allergies", "conditions", "medications"] as const).map((k) =>
                    c[k] ? (
                      <div key={k}>
                        <dt className="inline font-semibold text-pink-soft capitalize">{k}: </dt>
                        <dd className="inline">{c[k]}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              )}
              <div className="mt-3">
                <Disclosure summary={c ? "Edit" : "Fill in"}>
                  <MedicalForm action={saveMedicalCard} hidden={{ player_id: p.id }} values={c} />
                </Disclosure>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
