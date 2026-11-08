import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePlayerPage, isHeadCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isISODate, todayISO, weekStart } from "@/lib/dates";
import { isUuid, type Player } from "@/lib/softball";
import { Loading } from "@/components/ui";
import {
  loadHarada, loadIq, loadMentalPlan, loadPerformance, loadPopReport, loadSmartGoals,
  loadMovementAndHitting, loadTeamDugout, loadTwisWeek,
} from "./data";
import { PlayerMenu } from "./player-menu";
import { loadAdvanced } from "./advanced-data";
import { loadLeaderCertificate, loadLeadership } from "./leadership-data";
import { signedPhotoUrls } from "@/lib/player-photos";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";

export const metadata: Metadata = { title: "Player · GGG.Cafe" };

export default function PlayerDashboardPage({ params, searchParams }: PageProps<"/players/[playerId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <PlayerDashboard params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlayerDashboard({ params, searchParams }: Pick<PageProps<"/players/[playerId]">, "params" | "searchParams">) {
  const { playerId } = await params;
  const { week } = await searchParams;
  if (!isUuid(playerId)) notFound();
  // staff, or the player herself with an approved claim for this season
  const access = await requirePlayerPage(playerId);

  const supabase = await createClient();
  const { data } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
  const player = data as Player | null;
  if (!player) notFound();

  const today = todayISO();
  const monday = weekStart(isISODate(week) ? week : today);
  const [twis, chart, mental, pop, smartGoals, performance, iq, dugout, styles, advanced] = await Promise.all([
    loadTwisWeek(supabase, player.id, monday),
    loadHarada(supabase, player.id),
    loadMentalPlan(supabase, player.id),
    loadPopReport(supabase, player.id),
    loadSmartGoals(supabase, player.id),
    loadPerformance(supabase, player.id),
    loadIq(supabase, player.id),
    loadTeamDugout(supabase, player.id),
    loadMovementAndHitting(supabase, player.id),
    loadAdvanced(supabase, player.id),
  ]);
  const [leadership, certificate] = await Promise.all([
    loadLeadership(supabase, player.id, advanced.unlocked),
    // the Leader Badge: RLS shows it only to coaches/admins and the player herself
    loadLeaderCertificate(supabase, player.id),
  ]);
  const photoUrl = player.photo_path ? ((await signedPhotoUrls(supabase, [player.photo_path])).get(player.photo_path) ?? null) : null;
  // Mentor messages: new ones show as alerts at the top of her menu
  const [{ data: unreadRows }, { count: messageCount }] = await Promise.all([
    supabase.from("mentor_messages").select(MESSAGE_COLUMNS).eq("player_id", player.id).is("read_at", null).order("created_at", { ascending: false }).limit(10),
    supabase.from("mentor_messages").select("id", { count: "exact", head: true }).eq("player_id", player.id),
  ]);
  const unread = (unreadRows ?? []) as MentorMessage[];
  const messagePhotos = await signedMessagePhotoUrls(supabase, unread.map((m) => m.photo_path));

  return (
    <PlayerMenu
      player={player}
      twis={twis}
      chart={chart}
      mental={mental}
      pop={pop}
      smartGoals={smartGoals}
      performance={performance}
      iq={iq}
      dugout={dugout}
      photoUrl={photoUrl}
      styles={styles}
      today={today}
      canEdit={access.canAct}
      canManage={access.canManage}
      canWriteCulture={Boolean(access.user.staff && isHeadCoach(access.user.staff.role))}
      isSelf={access.isSelf}
      advanced={advanced}
      leadership={leadership.open ? leadership.work : null}
      leader={Boolean(certificate)}
      mentorMessages={{ unread, total: messageCount ?? 0, photoUrls: messagePhotos }}
      isAdmin={access.user.staff?.role === "admin"}
    />
  );
}
