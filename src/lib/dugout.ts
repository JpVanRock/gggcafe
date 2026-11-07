// Coaches Dugout reference values and practice-plan math. No imports, so it runs
// in server and client code and in unit tests (npm run test:unit). The tag and
// setting values must match the enums in the coaches_dugout migration.

export const DRILL_TAGS = [
  "warm_up", "throwing", "infield", "outfield", "defense", "pitchers", "catchers", "catchers_pitchers",
] as const;
export type DrillTag = (typeof DRILL_TAGS)[number];
export const DRILL_TAG_LABEL: Record<DrillTag, string> = {
  warm_up: "Warm-up Routine",
  throwing: "Throwing Routine",
  infield: "Infield",
  outfield: "Outfield",
  defense: "Defense",
  pitchers: "Pitchers",
  catchers: "Catchers",
  catchers_pitchers: "Catchers & Pitchers",
};

export const PRACTICE_SETTINGS = ["outdoor", "indoor"] as const;
export type PracticeSetting = (typeof PRACTICE_SETTINGS)[number];
export const PRACTICE_SETTING_LABEL: Record<PracticeSetting, string> = { outdoor: "Outdoor", indoor: "Indoor" };

/** Total practice time choices, in minutes. */
export const TOTAL_TIME_OPTIONS = [45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240] as const;

/** The nine spots on the practice field. */
export const PLAN_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
export type PlanPosition = (typeof PLAN_POSITIONS)[number];

export const MAX_BLOCK_MINUTES = 240;

/** "90 min", "1 hr", "1 hr 45 min" */
export function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "17:30" or "17:30:00" -> minutes after midnight; null when blank or invalid. */
export function parseClock(time: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

/** Minutes after midnight -> "5:30 PM" (wraps past midnight). */
export function clockLabel(minutesAfterMidnight: number) {
  const total = ((minutesAfterMidnight % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "5:30–5:45 PM", or "11:30 AM–12:15 PM" when it crosses noon. */
export function clockRange(from: number, to: number) {
  const a = clockLabel(from);
  const b = clockLabel(to);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
}

/** Elapsed minutes -> "0:45", "1:30" */
export function elapsedLabel(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export type TimelineSlot = {
  /** minutes from the start of practice */
  start: number;
  end: number;
  /** "5:30–5:45 PM" with a start time, else "0:00–0:15"; null until the block has minutes */
  label: string | null;
};

/**
 * Start and end of each block in order. A block without minutes yet takes no
 * time and has no label. With a start time the labels are clock times.
 */
export function planTimeline(startTime: string | null | undefined, blocks: { minutes: number | null }[]) {
  const clock = parseClock(startTime);
  let at = 0;
  const slots: TimelineSlot[] = blocks.map((b) => {
    const minutes = b.minutes && b.minutes > 0 ? b.minutes : 0;
    const start = at;
    at += minutes;
    const label = minutes
      ? clock === null
        ? `${elapsedLabel(start)}–${elapsedLabel(at)}`
        : clockRange(clock + start, clock + at)
      : null;
    return { start, end: at, label };
  });
  return { slots, used: at };
}

/** "5:30–7:30 PM" for the whole practice, or null without a start time. */
export function practiceRange(startTime: string | null | undefined, totalMinutes: number) {
  const clock = parseClock(startTime);
  return clock === null ? null : clockRange(clock, clock + totalMinutes);
}

/**
 * One equipment checklist for the whole plan: each block's list split on commas,
 * semicolons and new lines, trimmed, duplicates (ignoring case) removed, in the
 * order first needed.
 */
export function equipmentChecklist(blocks: { equipment: string | null }[]) {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const b of blocks) {
    for (const raw of (b.equipment ?? "").split(/[,;\n]+/)) {
      const item = raw.trim().replace(/\s+/g, " ");
      const key = item.toLowerCase();
      if (item && !seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    }
  }
  return items;
}

/** What still stops a plan from being finalized, as short sentences. */
export function finalizeProblems(blocks: { name: string; minutes: number | null }[]) {
  const problems: string[] = [];
  if (blocks.length === 0) problems.push("Add at least one drill.");
  const missing = blocks.filter((b) => !b.minutes);
  if (missing.length === 1) problems.push(`Set a time limit for “${missing[0].name}”.`);
  else if (missing.length > 1) problems.push(`Set a time limit for ${missing.length} drills.`);
  return problems;
}

/** A drill in the shared library. */
export type LibraryDrill = {
  id: string;
  name: string;
  description: string | null;
  tags: DrillTag[];
  equipment: string | null;
};

/** Library drills matching a search and a tag ("all" for every tag). */
export function filterDrills<T extends LibraryDrill>(drills: T[], search: string, tag: DrillTag | "all") {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return drills.filter((d) => {
    if (tag !== "all" && !d.tags.includes(tag)) return false;
    const haystack = `${d.name} ${d.description ?? ""} ${d.equipment ?? ""}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

// ---------------------------------------------------------------------------
// Practice field geometry (viewBox 0 0 400 430), shared by the web field and the
// PDF so both look the same. Each spot is where the position badge sits; the
// players placed there stack underneath it.
// ---------------------------------------------------------------------------
export const FIELD_W = 400;
export const FIELD_H = 430;
export const FIELD_SPOT: Record<PlanPosition, [number, number]> = {
  CF: [200, 70],
  LF: [80, 104],
  RF: [320, 104],
  SS: [148, 168],
  "2B": [252, 168],
  "3B": [84, 208],
  "1B": [316, 208],
  P: [200, 246],
  C: [200, 362],
};
export const FIELD_SHAPES = {
  grass: "M200 335 L2 137 A280 280 0 0 1 398 137 Z",
  foulLines: "M200 335 L2 137 M200 335 L398 137",
  fence: "M2 137 A280 280 0 0 1 398 137",
  infieldArc: "M80 215 A170 170 0 0 1 320 215",
  diamond: "M200 335 L295 240 L200 145 L105 240 Z",
  bases: [[295, 240], [200, 145], [105, 240]] as [number, number][],
  plate: "M193 331 h14 v5 l-7 6 l-7 -6 Z",
  circle: { cx: 200, cy: 248, r: 18 },
};
