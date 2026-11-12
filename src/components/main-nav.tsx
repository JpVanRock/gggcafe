// The top menu. Staff get the full menu (with a count of approvals waiting on the
// Coaches Dugout) on every page, including the player (/me) and family (/family)
// homes; everyone else gets `fallback`. Head coaches and admins also get the
// notifications bell (new Player of the Week...); admins get the FAQ.
// On phones the menu sits behind the header's Menu button; MenuCount puts the same
// counts on that button.
import { cache, type ReactNode } from "react";
import { canEdit, getAdminTeamIds, getCurrentUser, getMyPlayerIds, isHeadCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getWaitingCount } from "@/lib/approvals";
import { CountBadge } from "@/components/ui";
import { NavLink } from "@/components/nav-link";
import { navClass, navItemClass } from "@/components/site-header";

const NAV = [
  { href: "/dashboard", section: "/dashboard", label: "Dashboard" },
  { href: "/dugout/roster", section: "/dugout", label: "Coaches Dugout" }, // opens the first tab, Roster
  { href: "/teams", section: "/teams", label: "Teams" },
  { href: "/players", section: "/players", label: "Players" },
] as const;

/** The signed-in staff member and their counts, fetched once per request (menu and Menu button share it). */
const loadMenu = cache(async () => {
  const user = await getCurrentUser();
  if (!user?.staff) return null;
  const editor = canEdit(user.staff.role);
  const headCoach = isHeadCoach(user.staff.role);
  const supabase = await createClient();
  const [waiting, notes] = await Promise.all([
    editor ? getWaitingCount() : 0,
    // Player of the Week notices go to head coaches and admins
    headCoach ? supabase.rpc("unread_notifications").then((r) => Number(r.data ?? 0)) : 0,
  ]);
  return { staff: user.staff, headCoach, waiting, unread: notes };
});

export async function MainNav({ fallback = null }: { fallback?: ReactNode }) {
  const menu = await loadMenu();
  if (!menu) return fallback;
  const { staff, headCoach, waiting, unread } = menu;
  return (
    <nav aria-label="Main" className={navClass}>
      {NAV.map((item) => (
        <NavLink key={item.href} href={item.href} section={item.section} className={navItemClass}>
          {item.label}
          {item.href === "/dugout/roster" && <CountBadge count={waiting} label={`${waiting} approval${waiting === 1 ? "" : "s"} waiting`} />}
        </NavLink>
      ))}
      {staff.role === "admin" && (
        <NavLink href="/faq" className={navItemClass}>
          FAQ
        </NavLink>
      )}
      {headCoach && (
        <NavLink href="/notifications" className={navItemClass} aria-label={unread ? `Notifications: ${unread} new` : "Notifications"} title="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {/* on phones the bell sits in a list, so it gets its name */}
          <span className="sm:hidden">Notifications</span>
          <CountBadge count={unread} label={`${unread} new`} tone="neon" />
        </NavLink>
      )}
    </nav>
  );
}

/** The phone Menu button's count: approvals waiting plus new notifications. */
export async function MenuCount() {
  const menu = await loadMenu();
  const total = menu ? menu.waiting + menu.unread : 0;
  return <CountBadge count={total} label={`${total} waiting for you`} />;
}

/** What players see in the staff area's menu. */
/**
 * The menu for signed-in non-staff on player pages: players get My profile; a parent viewing as her
 * daughter (user, 2026-11-12) gets her family home.
 */
export async function NonStaffNav() {
  if ((await getMyPlayerIds()).length) return <PlayerNav />;
  const teamAdmin = (await getAdminTeamIds()).length > 0;
  return (
    <nav aria-label="Main" className={navClass}>
      <NavLink href="/family" exact className={navItemClass}>
        Family home
      </NavLink>
      {/* a team admin's Dugout: Calendar, GameDay, Measurements (user, 2026-11-12) */}
      {teamAdmin && (
        <NavLink href="/dugout/calendar" section="/dugout" className={navItemClass}>
          Coaches Dugout
        </NavLink>
      )}
    </nav>
  );
}

export function PlayerNav() {
  return (
    <nav aria-label="Main" className={navClass}>
      <NavLink href="/me" className={navItemClass}>
        My profile
      </NavLink>
    </nav>
  );
}
