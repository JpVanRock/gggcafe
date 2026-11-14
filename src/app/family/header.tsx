// The family pages' header: logo, the menu (Home; the Coaches Dugout for a team admin), the bell,
// theme, sign out. Staff see their own menu instead.
import { Suspense } from "react";
import { MainNav, MenuCount } from "@/components/main-nav";
import { NavLink } from "@/components/nav-link";
import { SignOutButton, SiteHeader, navClass, navItemClass } from "@/components/site-header";
import { isStaffParent } from "@/components/role-switch";
import { SwitchboardPill } from "@/components/switchboard-pill";
import { getAdminTeamIds, getCurrentUser } from "@/lib/auth";
import { NotificationBell } from "@/components/notification-bell";

/**
 * Parents' menu: Home, the Coaches Dugout for a team admin, and the bell. The Yearbook isn't here: its
 * banner tops the family menu (user, 2026-11-13).
 */
async function FamilyNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const adminTeams = await getAdminTeamIds();
  return (
    <nav aria-label="Main" className={navClass}>
      <NavLink href="/family" exact className={navItemClass}>
        Home
      </NavLink>
      {/* a team admin's Dugout: Calendar, GameDay, Measurements (user, 2026-11-12) */}
      {adminTeams.length > 0 && (
        <NavLink href="/dugout/calendar" className={navItemClass}>
          Coaches Dugout
        </NavLink>
      )}
      {/* video call notices (user, 2026-11-12) */}
      <NotificationBell />
    </nav>
  );
}

const areaLabel = <span className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Family</span>;

/**
 * The family pages' menu: parents get theirs; staff get the staff menu, except a coach who is
 * also a parent here, who is on the Parent page and gets the parents' menu (user, 2026-11-12).
 */
async function FamilyMenu() {
  if (await isStaffParent()) return <FamilyNav />;
  return (
    <MainNav
      fallback={
        <Suspense fallback={areaLabel}>
          <FamilyNav />
        </Suspense>
      }
    />
  );
}

export function FamilyHeader() {
  return (
    <>
      <SiteHeader
        home={{ href: "/family", label: "GGG.Cafe family home" }}
        nav={
          <Suspense fallback={areaLabel}>
            <FamilyMenu />
          </Suspense>
        }
        account={<SignOutButton />}
        count={
          <Suspense fallback={null}>
            <MenuCount />
          </Suspense>
        }
      />
      {/* a coach who is also a parent: the Coach / Parent switch under the menu, as on the Coach pages (user, 2026-11-13) */}
      <Suspense fallback={null}>
        <SwitchboardPill current="parent" />
      </Suspense>
    </>
  );
}
