// Parent view / Player view (user, 2026-11-16: "Once created they should have a toggle view between
// parent view and player view"), as links since the 2026-11-18 design audit (N3). A parent whose daughter has a login switches between the family page
// and her player pages (read only, as she sees them: View as player). One daughter: "Player view";
// several: "Maya's view", one pill each. Nothing until a daughter has a login, she's on her team's
// current roster, and her head coach leaves View as player on (the Switchboard). On the family page's
// header and in the banner on her pages (parent-view-banner.tsx).
import Link from "next/link";
import { cache } from "react";
import { getMyChildIds, getPlayerFeaturesOff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buttonStyles } from "@/components/ui";

export type PlayerView = { playerId: string; first: string };

/** The daughters whose pages this parent can switch to: each has a login. Once per request. */
export const loadPlayerViews = cache(async (): Promise<PlayerView[]> => {
  const supabase = await createClient();
  const [{ data }, childIds] = await Promise.all([supabase.rpc("parent_player_logins"), getMyChildIds()]);
  const withLogin = ((data ?? []) as { player_id: string; player_name: string; username: string | null; has_account: boolean }[]).filter(
    (d) => (d.username || d.has_account) && childIds.includes(d.player_id),
  );
  const open = await Promise.all(withLogin.map(async (d) => !(await getPlayerFeaturesOff(d.player_id)).has("parent.view_as")));
  return withLogin.filter((_, i) => open[i]).map((d) => ({ playerId: d.player_id, first: d.player_name.split(" ")[0] }));
});

/**
 * `current`: "parent" on the family pages (a link to each daughter's view), else the daughter whose pages
 * are open (back to the family menu, and her sisters' views). Links, not a segmented switch: the header's
 * Coach / Parent switch is the site's only switch (design audit 2026-11-18, N3).
 */
export async function ParentPlayerToggle({ current }: { current: "parent" | string }) {
  const views = await loadPlayerViews();
  if (!views.length) return null;
  const others = views.filter((v) => v.playerId !== current);
  return (
    <nav aria-label="Parent or player view" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {current !== "parent" && (
        <Link href="/family" className="text-sm font-semibold text-link hover:underline">
          <span aria-hidden="true">←</span> Family menu
        </Link>
      )}
      {others.map((v) =>
        current === "parent" ? (
          <Link key={v.playerId} href={`/players/${v.playerId}`} className={buttonStyles("secondary")}>
            See {views.length === 1 ? "her" : `${v.first}'s`} view <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <Link key={v.playerId} href={`/players/${v.playerId}`} className="text-sm font-semibold text-link hover:underline">
            {v.first}&apos;s view <span aria-hidden="true">→</span>
          </Link>
        ),
      )}
    </nav>
  );
}
