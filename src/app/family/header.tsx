// The family pages' header: logo, the menu (Home, and Yearbook when one of their
// teams has it), theme, sign out. Staff see their own menu instead.
import { Suspense } from "react";
import { MainNav, MenuCount } from "@/components/main-nav";
import { NavLink } from "@/components/nav-link";
import { SiteHeader, navClass, navItemClass } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { yearbookTeams } from "@/lib/yearbook-data";

/** Parents' menu: Home, plus Yearbook when a daughter on one of their teams has G3 Advanced. */
async function FamilyNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("parent_home");
  const teamIds = [...new Set(((data ?? []) as { team_id: string; status: string }[]).filter((l) => l.status === "approved").map((l) => l.team_id))];
  const withYearbook = await yearbookTeams(supabase, teamIds);
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
    </nav>
  );
}

const areaLabel = <span className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Family</span>;

export function FamilyHeader() {
  return (
    <SiteHeader
      home={{ href: "/family", label: "GGG.Cafe family home" }}
      nav={
        <Suspense fallback={areaLabel}>
          <MainNav
            fallback={
              <Suspense fallback={areaLabel}>
                <FamilyNav />
              </Suspense>
            }
          />
        </Suspense>
      }
      count={
        <Suspense fallback={null}>
          <MenuCount />
        </Suspense>
      }
    />
  );
}
