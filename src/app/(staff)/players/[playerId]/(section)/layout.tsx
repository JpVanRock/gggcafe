import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/softball";
import { LiveSectionNav, SectionNav } from "./section-nav";

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
  if (isUuid(playerId)) {
    const supabase = await createClient();
    const { data } = await supabase.from("players").select("first_name, preferred_name").eq("id", playerId).maybeSingle();
    if (data) name = (data.preferred_name as string | null) || (data.first_name as string);
  }
  return (
    <div className="flex flex-col gap-3">
      <Link href={`/players/${playerId}`} className="self-start text-sm text-muted hover:text-ink">
        ← Back to {name}&apos;s menu
      </Link>
      <Suspense fallback={<SectionNav playerId={playerId} />}>
        <LiveSectionNav playerId={playerId} />
      </Suspense>
    </div>
  );
}
