// Video calls (user, 2026-11-12): the call page is shared by mentors, head coaches, players and
// parents, so its header just goes home (/dashboard sends each account to its own home).
import type { ReactNode } from "react";
import { NavLink } from "@/components/nav-link";
import { SiteHeader, navClass, navItemClass } from "@/components/site-header";

export default function CallsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        home={{ href: "/dashboard", label: "GGG.Cafe home" }}
        nav={
          <nav aria-label="Main" className={navClass}>
            <NavLink href="/dashboard" className={navItemClass}>
              Home
            </NavLink>
          </nav>
        }
      />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
