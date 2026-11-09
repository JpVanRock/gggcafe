// G3 Leadership Guide on the server: access for its pages, links, and the locked
// view coaches see. Reads src/lib/leadership-guide.ts (server only).
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui";
import { loadAdvanced } from "./advanced-data";
import { loadLeaderCertificate, loadLeadership } from "./leadership-data";
import { LeaderToggle } from "./leadership-client";
import { firstName, loadPlayer } from "./section-data";

export function leadershipHref(playerId: string, slug?: string) {
  return `/players/${playerId}/advanced/leadership${slug ? `/${slug}` : ""}`;
}

/** Everything a Leadership Guide page needs. Players without the guide get a 404. */
export async function leadershipContext(playerId: string) {
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const book = await loadAdvanced(supabase, player.id);
  const [lead, certificate] = await Promise.all([loadLeadership(supabase, player.id, book.unlocked), loadLeaderCertificate(supabase, player.id)]);
  // staff can see why it's closed (and coaches can open it); nobody else learns it exists
  if (!lead.open && !access.user.staff && !certificate) notFound();
  return { access, player, book, lead, certificate, name: firstName(player) };
}

/** What staff see when the guide isn't open for a player. */
export function LeadershipClosed({
  playerId,
  name,
  hasAdvanced,
  picked,
  canManage,
}: {
  playerId: string;
  name: string;
  hasAdvanced: boolean;
  picked: boolean;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <EmptyState>
        {!hasAdvanced
          ? `The Leadership Guide is part of G3 Advanced, which isn't unlocked for ${name} yet.`
          : `${name} isn't being trained as a leader yet.`}
      </EmptyState>
      {canManage && hasAdvanced && !picked && <LeaderToggle playerId={playerId} name={name} on={false} />}
      <Link href={`/players/${playerId}`} className="text-sm text-link hover:underline">
        ← Back to {name}&apos;s menu
      </Link>
    </div>
  );
}
