import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlayerFeaturesOff, requirePlayerPage, isHeadCoach } from "@/lib/auth";
import { isSwitchKey, switchLabel, type SwitchKey } from "@/lib/switchboard";
import { ParentViewBanner } from "@/components/parent-view-banner";
import { createClient } from "@/lib/supabase/server";
import { isISODate, todayISO, weekStart } from "@/lib/dates";
import { isUuid, type Player } from "@/lib/softball";

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

export default async function PlayerDashboardPage({ params, searchParams }: PageProps<"/players/[playerId]">) {
  const { playerId } = await params;
  const { week, off: offParam } = await searchParams;
  if (!isUuid(playerId)) notFound();
  // staff, or the player herself with an approved claim for this season
  const access = await requirePlayerPage(playerId);

  const supabase = await createClient();
  const today = todayISO();
  const monday = weekStart(isISODate(week) ? week : today);
  // Everything that only needs the player's id loads together (one round trip, not six);
  // what depends on those results (her leadership book, signed photo links) loads next.
  const [{ data }, twis, chart, mental, pop, smartGoals, performance, iq, dugout, styles, advanced, certificate, { data: unreadRows }, { count: messageCount }, journalRows] =
    await Promise.all([
      supabase.from("players").select("*").eq("id", playerId).maybeSingle(),
      loadTwisWeek(supabase, playerId, monday),
      loadHarada(supabase, playerId),
      loadMentalPlan(supabase, playerId),
      loadPopReport(supabase, playerId),
      loadSmartGoals(supabase, playerId),
      loadPerformance(supabase, playerId),
      loadIq(supabase, playerId),
      loadTeamDugout(supabase, playerId),
      loadMovementAndHitting(supabase, playerId),
      loadAdvanced(supabase, playerId),
      // the Leader Badge: RLS shows it only to coaches/admins and the player herself
      loadLeaderCertificate(supabase, playerId),
      // Mentor messages: new ones show as alerts at the top of her menu
      supabase.from("mentor_messages").select(MESSAGE_COLUMNS).eq("player_id", playerId).is("read_at", null).order("created_at", { ascending: false }).limit(10),
      supabase.from("mentor_messages").select("id", { count: "exact", head: true }).eq("player_id", playerId),
      // My Journal: hers and her parents' (coaches read nothing, so they don't ask)
      access.isSelf || access.isParent
        ? supabase.from("player_journal_entries").select("session_date", { count: "exact" }).eq("player_id", playerId).order("session_date", { ascending: false }).limit(1)
        : Promise.resolve(null),
    ]);
  const player = data as Player | null;
  if (!player) notFound();
  const unread = (unreadRows ?? []) as MentorMessage[];
  // the Switchboard: what her head coach turned off (coaches see everything)
  const off = access.user.staff ? new Set<SwitchKey>() : await getPlayerFeaturesOff(player.id);
  const offNotice = isSwitchKey(offParam) && off.has(offParam) ? switchLabel(offParam) : null;
  const [leadership, photos, messagePhotos] = await Promise.all([
    loadLeadership(supabase, player.id, advanced.unlocked),
    player.photo_path ? signedPhotoUrls(supabase, [player.photo_path]) : Promise.resolve(null),
    signedMessagePhotoUrls(supabase, unread.map((m) => m.photo_path)),
  ]);
  const photoUrl = player.photo_path ? (photos?.get(player.photo_path) ?? null) : null;

  const menu = (
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
      canWriteCulture={Boolean(access.user.staff && isHeadCoach(access.user.staff.role))}
      isSelf={access.isSelf}
      advanced={advanced}
      leadership={leadership.open ? { work: leadership.work, program: leadership.program } : null}
      leader={Boolean(certificate)}
      mentorMessages={{ unread, total: messageCount ?? 0, photoUrls: messagePhotos }}
      isAdmin={access.user.staff?.role === "admin"}
      journal={journalRows ? { count: journalRows.count ?? 0, last: journalRows.data?.[0]?.session_date ?? null } : null}
      off={off}
    />
  );
  const notice = offNotice && (
    <p role="status" className="rounded-xl border border-pink/60 bg-pink/10 px-4 py-3 text-sm">
      {offNotice} is turned off for now by the head coach.
    </p>
  );
  // her approved parent viewing as her (user, 2026-11-12): what she sees, read only
  if (!access.isParent && !notice) return menu;
  return (
    <div className="flex flex-col gap-4">
      {access.isParent && <ParentViewBanner playerId={player.id} />}
      {notice}
      {menu}
    </div>
  );
}
