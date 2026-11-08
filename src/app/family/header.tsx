// The family pages' header: logo, the menu (Home, and Yearbook when one of their
// teams has it), theme, sign out. Staff see their own menu instead.
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { MainNav } from "@/components/main-nav";
import { secondaryButtonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { yearbookTeams } from "@/lib/yearbook-data";

const navClass = "flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium uppercase tracking-wider";

/** Parents' menu: Home, plus Yearbook when a daughter on one of their teams has G3 Advanced. */
async function FamilyNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("parent_home");
  const teamIds = [...new Set(((data ?? []) as { team_id: string; status: string }[]).filter((l) => l.status === "approved").map((l) => l.team_id))];
  const withYearbook = await yearbookTeams(supabase, teamIds);
  return (
    <nav className={navClass}>
      <Link href="/family" className="text-muted hover:text-highlight">
        Home
      </Link>
      {withYearbook.length > 0 && (
        <Link href="/family/yearbook" className="text-muted hover:text-highlight">
          Yearbook
        </Link>
      )}
    </nav>
  );
}

export function FamilyHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-pink/40 bg-navy-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <Link href="/family" aria-label="GGG.Cafe family home" className="shrink-0">
          <Logo size={44} className="h-11 w-11" />
        </Link>
        <Suspense fallback={<span className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Family</span>}>
          <MainNav
            fallback={
              <Suspense fallback={<span className="font-mono text-xs tracking-[0.25em] text-pink-soft uppercase">Family</span>}>
                <FamilyNav />
              </Suspense>
            }
          />
        </Suspense>
        <div className="ml-auto flex items-center gap-4">
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit" className={secondaryButtonClass}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
