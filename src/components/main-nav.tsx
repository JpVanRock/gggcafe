// The top menu. Staff get the full menu (with a count of approvals waiting on the
// Coaches Dugout) on every page, including the player (/me) and family (/family)
// homes; everyone else gets `fallback`. Head coaches and admins also get the
// notifications bell (new Player of the Week...); admins get the FAQ.
import type { ReactNode } from "react";
import { canEdit, getCurrentUser, isHeadCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getWaitingCount } from "@/lib/approvals";
import { CountBadge } from "@/components/ui";
import { NavLink } from "@/components/nav-link";

const NAV = [
  { href: "/dashboard", section: "/dashboard", label: "Dashboard" },
  { href: "/dugout/roster", section: "/dugout", label: "Coaches Dugout" }, // opens the first tab, Roster
  { href: "/teams", section: "/teams", label: "Teams" },
  { href: "/players", section: "/players", label: "Players" },
] as const;

const navClass = "flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium uppercase tracking-wider";

export async function MainNav({ fallback = null }: { fallback?: ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.staff) return fallback;
  let waiting = 0;
  let unread = 0;
  const editor = canEdit(user.staff.role);
  if (editor) {
    const supabase = await createClient();
    const [count, { data: notes }] = await Promise.all([getWaitingCount(), supabase.rpc("unread_notifications")]);
    waiting = count;
    unread = Number(notes ?? 0);
  }
  return (
    <nav aria-label="Main" className={navClass}>
      {NAV.map((item) => (
        <NavLink key={item.href} href={item.href} section={item.section} className="inline-flex items-center gap-1.5">
          {item.label}
          {item.href === "/dugout/roster" && <CountBadge count={waiting} label={`${waiting} approval${waiting === 1 ? "" : "s"} waiting`} />}
        </NavLink>
      ))}
      {user.staff.role === "admin" && (
        <NavLink href="/faq">FAQ</NavLink>
      )}
      {/* Player of the Week notices go to head coaches and admins */}
      {isHeadCoach(user.staff.role) && (
        <NavLink
          href="/notifications"
          className="inline-flex items-center gap-1"
          aria-label={unread ? `Notifications: ${unread} new` : "Notifications"}
          title="Notifications"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <CountBadge count={unread} label={`${unread} new`} tone="neon" />
        </NavLink>
      )}
    </nav>
  );
}

/** What players see in the staff area's menu. */
export function PlayerNav() {
  return (
    <nav aria-label="Main" className={navClass}>
      <NavLink href="/me">My profile</NavLink>
    </nav>
  );
}
