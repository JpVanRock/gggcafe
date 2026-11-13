// The mentor area: mentors and skill coaches (not staff) see the players coaches
// assign them. Its own header: logo, My players, notifications, theme, sign out.
import { Suspense, type ReactNode } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { NavLink } from "@/components/nav-link";
import { SiteHeader, navClass, navItemClass } from "@/components/site-header";

export default function MentorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        home={{ href: "/mentor", label: "GGG.Cafe mentor home" }}
        nav={
          <nav aria-label="Main" className={navClass}>
            <NavLink href="/mentor" className={navItemClass}>
              My players
            </NavLink>
            {/* a head coach cancelling one of their video calls (user, 2026-11-12) */}
            <Suspense fallback={null}>
              <NotificationBell />
            </Suspense>
          </nav>
        }
      />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
