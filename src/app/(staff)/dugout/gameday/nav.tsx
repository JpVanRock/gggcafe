import { PillNav, teamPages } from "@/components/pill-nav";

const PAGES = [
  { key: "lineups", href: "/dugout/gameday", label: "Lineups & player cards" },
  { key: "depth", href: "/dugout/gameday/depth", label: "Depth chart" },
  { key: "box", href: "/dugout/gameday/box", label: "Box scores" },
] as const;

/** The GameDay tab's pages. */
export function GamedayNav({ current, teamId }: { current: (typeof PAGES)[number]["key"]; teamId: string }) {
  return <PillNav label="GameDay" current={current} items={teamPages(PAGES, teamId)} />;
}
