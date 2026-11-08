import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading } from "@/components/ui";
import { signedPhotoUrls } from "@/lib/player-photos";
import type { MoveSeason, MoveTeam } from "../../../move-form";
import { loadMovementAndHitting, loadPopReport, possessive } from "../../data";
import { PopDetail } from "../../pop-report";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

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
    </SectionShell>
  );
}
