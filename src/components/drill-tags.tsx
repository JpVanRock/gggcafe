// Small tag labels for practice drills. Server-safe.
import { DRILL_TAG_LABEL, type DrillTag } from "@/lib/dugout";

export function DrillTags({ tags, className = "" }: { tags: DrillTag[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Tags">
      {tags.map((t) => (
        <li
          key={t}
          className="rounded border border-navy-600 px-1.5 py-px font-mono text-[10px] font-bold tracking-wider text-muted uppercase"
        >
          {DRILL_TAG_LABEL[t]}
        </li>
      ))}
    </ul>
  );
}
