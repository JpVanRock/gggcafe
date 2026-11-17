// Parent view / Player view (user, 2026-11-16: "Once created they should have a toggle view between
// parent view and player view"). A parent whose daughter has a login switches between the family page
// and her player pages (read only, as she sees them: View as player). One daughter: "Player view";
// several: "Maya's view", one pill each. Nothing until a daughter has a login, she's on her team's
// current roster, and her head coach leaves View as player on (the Switchboard). On the family page's
// header and in the banner on her pages (parent-view-banner.tsx).
import Link from "next/link";
import { cache } from "react";
import { getMyChildIds, getPlayerFeaturesOff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

const item = "inline-flex min-h-9 items-center rounded-full px-4 transition";

/** `current`: "parent" on the family pages, else the daughter whose pages are open. */
export async function ParentPlayerToggle({ current }: { current: "parent" | string }) {
  const views = await loadPlayerViews();
  if (!views.length) return null;
  const links: [string, string, string][] = [
    ["parent", "/family", "Parent view"],
    ...views.map((v): [string, string, string] => [v.playerId, `/players/${v.playerId}`, views.length === 1 ? "Player view" : `${v.first}'s view`]),
  ];
  return (
    <nav aria-label="Parent or player view" className="inline-flex flex-wrap rounded-full border border-navy-600 p-0.5 text-xs font-semibold tracking-wider uppercase">
      {links.map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? "page" : undefined}
          className={`${item} ${current === key ? "bg-pink text-on-accent" : "text-muted hover:text-ink"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
