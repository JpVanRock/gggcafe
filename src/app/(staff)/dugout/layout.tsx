import { Suspense, type ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { DugoutTabs, TabList } from "./tabs";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { getWaitingCount } from "@/lib/approvals";

/** The tabs for her role, with how many approvals are waiting on the Roster tab (coaches). */
async function TabsWithCounts() {
  const user = await getCurrentUser();
  const waiting = user?.staff && canEdit(user.staff.role) ? await getWaitingCount() : 0;
  return <DugoutTabs badges={{ "/dugout/roster": waiting }} role={user?.staff?.role} />;
}

export default function DugoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title="Coaches Dugout" description="Organize your team: standards, culture, calendar, drills and practice plans." />
        {/* until her role is known, only the tabs every coach has */}
        <Suspense fallback={<TabList role="assistant" />}>
          <TabsWithCounts />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
