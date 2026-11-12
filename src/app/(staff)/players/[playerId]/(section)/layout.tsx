import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { LiveSectionNav, SectionNav } from "./section-nav";
import { ParentViewBanner } from "@/components/parent-view-banner";
import { getCurrentUser, getPlayerFeaturesOff } from "@/lib/auth";
import { SECTION_SWITCH } from "@/lib/switchboard";

/**
 * Every player section (Goals, Pop Report, ...) is its own page: a Back link to
 * her menu and a menu bar to jump between sections, then the section itself.
 */
export default function SectionLayout({ children, params }: LayoutProps<"/players/[playerId]">) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<div className="h-20" aria-hidden />}>
        <SectionHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function SectionHeader({ params }: { params: LayoutProps<"/players/[playerId]">["params"] }) {
  const { playerId } = await params;
  let name = "Player";
  let advanced = false;
  let hidden: string[] = [];
  if (isUuid(playerId)) {
    // the Switchboard: sections her head coach turned off leave the bar (coaches see them all)
    const user = await getCurrentUser();
    if (user && !user.staff) {
      const off = await getPlayerFeaturesOff(playerId);
      hidden = Object.entries(SECTION_SWITCH).flatMap(([slug, key]) => (off.has(key) ? [slug] : []));
    }
    const supabase = await createClient();
    const [{ data }, { data: access }] = await Promise.all([
      supabase.from("players").select("first_name, preferred_name").eq("id", playerId).maybeSingle(),
      // G3 Advanced shows in the menu only when it's unlocked for her
      supabase.from("player_advanced_access").select("player_id").eq("player_id", playerId).maybeSingle(),
    ]);
    if (data) name = (data.preferred_name as string | null) || (data.first_name as string);
    advanced = Boolean(access);
  }
  return (
    <div className="flex flex-col gap-3">
      <ParentViewBanner playerId={playerId} />
      <Link href={`/players/${playerId}`} className="self-start text-sm text-muted hover:text-ink">
        ← Back to {name}&apos;s menu
      </Link>
      <Suspense fallback={<SectionNav playerId={playerId} advanced={advanced} hidden={hidden} />}>
        <LiveSectionNav playerId={playerId} advanced={advanced} hidden={hidden} />
      </Suspense>
    </div>
  );
}
