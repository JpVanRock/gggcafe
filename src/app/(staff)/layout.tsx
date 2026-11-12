import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { SignOutButton, SiteHeader } from "@/components/site-header";
import { MainNav, MenuCount, NonStaffNav } from "@/components/main-nav";
import { HeaderTeamLogo } from "@/components/header-team-logo";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        home={{ href: "/dashboard", label: "GGG.Cafe dashboard" }}
        teamLogo={
          <Suspense fallback={null}>
            <HeaderTeamLogo />
          </Suspense>
        }
        nav={
          <Suspense fallback={<nav className="flex gap-4 text-sm" aria-hidden />}>
            <MainNav
              fallback={
                <Suspense fallback={null}>
                  <NonStaffNav />
                </Suspense>
              }
            />
          </Suspense>
        }
        account={
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        }
        count={
          <Suspense fallback={null}>
            <MenuCount />
          </Suspense>
        }
      />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
      {user.staff && (
        <span className="text-sm text-muted">
          {user.staff.displayName} · {ROLE_LABEL[user.staff.role]}
        </span>
      )}
      <SignOutButton />
    </div>
  );
}
