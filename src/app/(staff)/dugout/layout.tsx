import { Suspense, type ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { DugoutTabs, TabList } from "./tabs";

export default function DugoutLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title="Coaches Dugout" description="Organize your team: standards, culture, calendar, drills and practice plans." />
        <Suspense fallback={<TabList />}>
          <DugoutTabs />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
