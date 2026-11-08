// The top menu. Staff get the full menu (with a count of approvals waiting on the
// Coaches Dugout) on every page, including the player (/me) and family (/family)
// homes; everyone else gets `fallback`. Coaches and admins also get the
// notifications bell (new Player of the Week...).
import Link from "next/link";
import type { ReactNode } from "react";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dugout/roster", label: "Coaches Dugout" }, // opens the first tab, Roster
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
] as const;

const navClass = "flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium uppercase tracking-wider";
const linkClass = "text-muted hover:text-highlight";

export async function MainNav({ fallback = null }: { fallback?: ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.staff) return fallback;
  let waiting = 0;
  let unread = 0;
  const editor = canEdit(user.staff.role);
  if (editor) {
    const supabase = await createClient();
    const [{ data }, { data: notes }] = await Promise.all([supabase.rpc("pending_approvals"), supabase.rpc("unread_notifications")]);
    waiting = ((data ?? []) as { player_claims: number; parent_requests: number }[]).reduce(
      (sum, t) => sum + Number(t.player_claims) + Number(t.parent_requests),
      0,
    );
    unread = Number(notes ?? 0);
  }
  return (
    <nav className={navClass}>
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} className={`${linkClass} inline-flex items-center gap-1.5`}>
          {item.label}
          {item.href === "/dugout/roster" && waiting > 0 && (
            <span
              className="grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1 font-mono text-[10px] font-bold text-on-accent"
              title={`${waiting} approval${waiting === 1 ? "" : "s"} waiting`}
            >
              {waiting}
            </span>
          )}
        </Link>
      ))}
      {editor && (
        <Link
          href="/notifications"
          className={`${linkClass} inline-flex items-center gap-1`}
          aria-label={unread ? `Notifications: ${unread} new` : "Notifications"}
          title="Notifications"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unread > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-neon px-1 font-mono text-[10px] font-bold text-on-accent">{unread}</span>
          )}
        </Link>
      )}
    </nav>
  );
}

/** What players see in the staff area's menu. */
export function PlayerNav() {
  return (
    <nav className={navClass}>
      <Link href="/me" className={linkClass}>
        My profile
      </Link>
    </nav>
  );
}
