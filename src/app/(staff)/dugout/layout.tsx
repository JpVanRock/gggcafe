import { Suspense, type ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { DugoutTabs, TabList } from "./tabs";
import { canEdit, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** The tabs, with how many approvals are waiting on the Roster tab (coaches). */
async function TabsWithCounts() {
  const user = await getCurrentUser();
  let waiting = 0;
  if (user?.staff && canEdit(user.staff.role)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("pending_approvals");
    waiting = ((data ?? []) as { player_claims: number; parent_requests: number }[]).reduce(
      (sum, t) => sum + Number(t.player_claims) + Number(t.parent_requests),
      0,
    );
  }
  return <DugoutTabs badges={{ "/dugout/roster": waiting }} />;
}

export default function DugoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title="Coaches Dugout" description="Organize your team: standards, culture, calendar, drills and practice plans." />
        <Suspense fallback={<TabList />}>
          <TabsWithCounts />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
