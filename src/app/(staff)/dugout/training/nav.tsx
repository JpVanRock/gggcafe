import { PillNav, teamPages } from "@/components/pill-nav";

const PAGES = [
  { key: "roadmap", href: "/dugout/training", label: "Roadmap & routines", head: false },
  { key: "testing", href: "/dugout/training/testing", label: "Testing", head: false },
  { key: "measurements", href: "/dugout/training/measurements", label: "Measurements", head: false },
  { key: "bullpens", href: "/dugout/training/bullpens", label: "Bullpens", head: false },
  { key: "bp", href: "/dugout/training/bp", label: "BP rounds", head: false },
  { key: "draft", href: "/dugout/training/draft", label: "Offseason draft", head: true },
  { key: "coach", href: "/dugout/training/coach", label: "Coach training", head: false },
] as const;

/** The Training tab's pages; the draft is for head coaches and admins only. */
export function TrainingNav({ current, teamId, head }: { current: (typeof PAGES)[number]["key"]; teamId: string; head: boolean }) {
  return <PillNav label="Training" current={current} items={teamPages(PAGES.filter((p) => head || !p.head), teamId)} />;
}
