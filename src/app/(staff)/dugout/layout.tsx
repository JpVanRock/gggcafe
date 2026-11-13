import { Suspense, type ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { MyTeamLogo } from "@/components/team-logo";
import { DugoutTabs, TabList } from "./tabs";
import { canEdit, getAdminTeamIds, getCurrentUser } from "@/lib/auth";
import { getWaitingCount } from "@/lib/approvals";

/** The tabs for her role, with how many approvals are waiting on the Roster tab (coaches). */
async function TabsWithCounts() {
  const user = await getCurrentUser();
  // a team admin (a parent the head coach named; user, 2026-11-12) gets their three tabs
  if (user && !user.staff && (await getAdminTeamIds()).length) return <DugoutTabs teamAdmin />;
  const waiting = user?.staff && canEdit(user.staff.role) ? await getWaitingCount() : 0;
  return <DugoutTabs badges={{ "/dugout/roster": waiting }} role={user?.staff?.role} />;
}

export default function DugoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        {/* the team logo on the right, beside the title (user, 2026-11-13); it never wraps under it */}
        <div className="mb-6 flex items-center justify-between gap-4 [&>header]:mb-0">
          <PageHeader title="Coaches Dugout" description="Organize your team: standards, culture, calendar, drills and practice plans." />
          <Suspense fallback={null}>
            <MyTeamLogo />
          </Suspense>
        </div>
        {/* until her role is known, only the tabs every coach has */}
        <Suspense fallback={<TabList role="assistant" />}>
          <TabsWithCounts />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
