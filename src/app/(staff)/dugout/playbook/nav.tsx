import { PillNav, teamPages } from "@/components/pill-nav";

const PAGES = [
  { key: "plays", href: "/dugout/playbook", label: "Call sheet" },
  { key: "quizzes", href: "/dugout/playbook/quizzes", label: "Team quizzes" },
  { key: "scouting", href: "/dugout/playbook/scouting", label: "Scouting" },
] as const;

/** The Playbook tab's pages. */
export function PlaybookNav({ current, teamId }: { current: (typeof PAGES)[number]["key"]; teamId: string }) {
  return <PillNav label="Playbook" current={current} items={teamPages(PAGES, teamId)} />;
}
