// Pieces shared by the practice plan builder's parts.
import type { PlanBlock } from "@/lib/practice-plans";
import type { PracticeSetting } from "@/lib/dugout";

export type Block = PlanBlock & { key: string };
export type Setup = {
  practice_date: string;
  start_time: string;
  setting: PracticeSetting;
  total_minutes: number;
  location: string;
  focus: string;
};

/** Key for a block added in the browser (only called from event handlers). */
export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

export const chip = "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition";
export const labelClass = "font-mono text-2xs font-bold tracking-wider text-muted uppercase";

export function GripIcon() {
  return (
    <svg viewBox="0 0 12 18" aria-hidden className="h-4 w-3" fill="currentColor">
      {[3, 9].map((x) => [3, 9, 15].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.5" />))}
    </svg>
  );
}
