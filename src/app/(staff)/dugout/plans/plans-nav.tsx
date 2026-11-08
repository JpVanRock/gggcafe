import { PillNav, teamPages } from "@/components/pill-nav";

const PAGES = [
  { key: "plans", href: "/dugout/plans", label: "Practice plans" },
  { key: "install", href: "/dugout/plans/install", label: "Install checklist" },
] as const;

/** The Practice Plans tab's pages. */
export function PlansNav({ current, teamId }: { current: (typeof PAGES)[number]["key"]; teamId: string }) {
  return <PillNav label="Practice planning" current={current} items={teamPages(PAGES, teamId)} />;
}
