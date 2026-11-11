import type { Metadata } from "next";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { signedPhotoUrls } from "@/lib/player-photos";
import type { MoveSeason, MoveTeam } from "../../../move-form";
import { loadMovementAndHitting, loadPopReport, loadTeamDugout, possessive } from "../../data";
import { PopDetail } from "../../pop-report";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";
import { seasonOrCurrent } from "@/lib/roster";
import { StatsCard, loadPlayerStats } from "../../stats-card";
import { MeasurementsBySeason, loadMeasurements } from "../../measurements";

export const metadata: Metadata = { title: "Pop Report · GGG.Cafe" };

export default async function PopPage({ params, searchParams }: PageProps<"/players/[playerId]/pop">) {
  const { playerId } = await params;
  const { year } = await searchParams;
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
  // her current own team and season, for her stats (the preseason questionnaire is on the parents' page)
  const ownTeam = (await loadTeamDugout(supabase, player.id))[0]?.team ?? null;
  const season = ownTeam ? await seasonOrCurrent(supabase, ownTeam.id, null) : null;
  const [stats, seasonName, measurements] = await Promise.all([
    loadPlayerStats(supabase, player.id, season),
    season ? supabase.from("seasons").select("name").eq("id", season).maybeSingle().then((r) => (r.data as { name: string } | null)?.name ?? null) : Promise.resolve(null),
    loadMeasurements(supabase, player, ownTeam?.id ?? null),
  ]);
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
        measurements={
          <MeasurementsBySeason
            playerId={player.id}
            data={measurements}
            year={typeof year === "string" && /^\d{4}$/.test(year) ? Number(year) : null}
            basePath={`/players/${player.id}/pop`}
            canEdit={access.canManage}
          />
        }
      />
      <StatsCard stats={stats} seasonLabel={seasonName} />
    </SectionShell>
  );
}
