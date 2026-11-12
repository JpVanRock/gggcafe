// The family pages' header: logo, the menu (Home, and Yearbook when one of their
// teams has it), theme, sign out. Staff see their own menu instead.
import { Suspense } from "react";
import { MainNav, MenuCount } from "@/components/main-nav";
import { NavLink } from "@/components/nav-link";
import { SignOutButton, SiteHeader, navClass, navItemClass } from "@/components/site-header";
import { RoleSwitch, isStaffParent } from "@/components/role-switch";
import { createClient } from "@/lib/supabase/server";
import { getAdminTeamIds, getCurrentUser } from "@/lib/auth";
import { yearbookTeams } from "@/lib/yearbook-data";
import { HeaderTeamLogo } from "@/components/header-team-logo";

/** Parents' menu: Home, plus Yearbook when a daughter on one of their teams has G3 Advanced. */
async function FamilyNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("parent_home");
  const teamIds = [...new Set(((data ?? []) as { team_id: string; status: string }[]).filter((l) => l.status === "approved").map((l) => l.team_id))];
  const [{ data: offRows }, adminTeams] = await Promise.all([
    teamIds.length ? supabase.from("team_features_off").select("team_id").eq("feature", "parent.yearbook").in("team_id", teamIds) : Promise.resolve({ data: [] }),
    getAdminTeamIds(),
  ]);
  const closed = new Set((offRows ?? []).map((r) => r.team_id));
  const withYearbook = await yearbookTeams(supabase, teamIds.filter((t) => !closed.has(t)));
  return (
    <nav aria-label="Main" className={navClass}>
      <NavLink href="/family" exact className={navItemClass}>
        Home
      </NavLink>
      {withYearbook.length > 0 && (
        <NavLink href="/family/yearbook" className={navItemClass}>
          Yearbook
        </NavLink>
      )}
      {/* a team admin's Dugout: Calendar, GameDay, Measurements (user, 2026-11-12) */}
      {adminTeams.length > 0 && (
        <NavLink href="/dugout/calendar" className={navItemClass}>
          Coaches Dugout
        </NavLink>
      )}
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
    <SiteHeader
      home={{ href: "/family", label: "GGG.Cafe family home" }}
      teamLogo={
        <Suspense fallback={null}>
          <HeaderTeamLogo />
        </Suspense>
      }
      nav={
        <Suspense fallback={areaLabel}>
          <FamilyMenu />
        </Suspense>
      }
      account={
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto">
          <Suspense fallback={null}>
            <RoleSwitch current="parent" />
          </Suspense>
          <SignOutButton />
        </div>
      }
      count={
        <Suspense fallback={null}>
          <MenuCount />
        </Suspense>
      }
    />
  );
}
