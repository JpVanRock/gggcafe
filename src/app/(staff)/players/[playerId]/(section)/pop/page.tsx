import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading } from "@/components/ui";
import { signedPhotoUrls } from "@/lib/player-photos";
import type { MoveSeason, MoveTeam } from "../../../move-form";
import { loadMovementAndHitting, loadPopReport, loadTeamDugout, possessive } from "../../data";
import { PopDetail } from "../../pop-report";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";
import type { Questionnaire } from "@/lib/family";
import { seasonOrCurrent } from "@/lib/roster";
import { saveQuestionnaire } from "../../family-actions";
import { QuestionnaireForm } from "@/components/family-forms";
import { Disclosure } from "@/components/ui";
import { StatsCard, loadPlayerStats } from "../../stats-card";

export const metadata: Metadata = { title: "Pop Report · GGG.Cafe" };

export default function PopPage({ params }: PageProps<"/players/[playerId]/pop">) {
  return (
    <Suspense fallback={<Loading />}>
      <Pop params={params} />
    </Suspense>
  );
}

async function Pop({ params }: Pick<PageProps<"/players/[playerId]/pop">, "params">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const [pop, styles, photos, move, { data: g3 }] = await Promise.all([
    loadPopReport(supabase, player.id),
    loadMovementAndHitting(supabase, player.id),
    signedPhotoUrls(supabase, [player.photo_path]),
    access.canManage
      ? Promise.all([
          supabase.from("teams").select("id, name, organization, age_group, is_own_team").order("is_own_team", { ascending: false }).order("name"),
          supabase.from("seasons").select("id, name").order("start_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
        ]).then(([t, s]) => ({ teams: (t.data ?? []) as MoveTeam[], seasons: (s.data ?? []) as MoveSeason[] }))
      : Promise.resolve(null),
    // Movement Preferences is G3 Advanced
    supabase.from("player_advanced_access").select("player_id").eq("player_id", player.id).maybeSingle(),
  ]);
  const movementAccess = g3 ? "open" : access.user.staff?.role === "admin" ? "locked" : "hidden";
  // Phase 6: her preseason questionnaire (her current own team and season; she and coaches)
  const ownTeam = (await loadTeamDugout(supabase, player.id))[0]?.team ?? null;
  const season = ownTeam ? await seasonOrCurrent(supabase, ownTeam.id, null) : null;
  const [stats, seasonName] = await Promise.all([
    loadPlayerStats(supabase, player.id, season),
    season ? supabase.from("seasons").select("name").eq("id", season).maybeSingle().then((r) => (r.data as { name: string } | null)?.name ?? null) : Promise.resolve(null),
  ]);
  const questionnaire =
    ownTeam && season && access.canAct
      ? (((await supabase.from("player_questionnaires").select("*").eq("player_id", player.id).eq("team_id", ownTeam.id).eq("season_id", season).maybeSingle()).data ??
          null) as Partial<Questionnaire> | null)
      : null;
  return (
    <SectionShell title={`${possessive(firstName(player))} Pop Report`} subtitle={`Profile · ${movementAccess === "open" ? "movement · " : ""}hitting style · teams · measurements`}>
      <PopDetail
        player={player}
        pop={pop}
        canEdit={access.canManage}
        canAct={access.canAct}
        photoUrl={player.photo_path ? (photos.get(player.photo_path) ?? null) : null}
        move={move}
        styles={styles}
        movementAccess={movementAccess}
      />
      <StatsCard stats={stats} seasonLabel={seasonName} />
      {ownTeam && season && access.canAct && (
        <section className="mt-10 flex flex-col gap-3">
          <h2 className="font-mono text-[0.75rem] leading-4 font-bold tracking-[0.2em] text-pink-soft uppercase">Preseason questionnaire · {ownTeam.name}</h2>
          <p className="text-sm text-muted">Sizes, jersey numbers and the positions she wants. Coaches see it; teammates don&apos;t.</p>
          <Disclosure summary={questionnaire ? "Edit the questionnaire ✓" : "Fill in the questionnaire"} open={!questionnaire}>
            <QuestionnaireForm action={saveQuestionnaire} hidden={{ player_id: player.id, team_id: ownTeam.id }} values={questionnaire} />
          </Disclosure>
        </section>
      )}
    </SectionShell>
  );
}
