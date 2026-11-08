// Installation checklist (Coaches Dugout → Practice Plans → Install): everything the
// team needs in place by opening day, by position and by situation, with how far each
// one has come. No imports: unit-tested with node --test.

export const INSTALL_STATUSES = ["not_started", "taught", "repped", "game_ready"] as const;
export type InstallStatus = (typeof INSTALL_STATUSES)[number];

export const INSTALL_STATUS_LABEL: Record<InstallStatus, string> = {
  not_started: "Not started",
  taught: "Taught",
  repped: "Repped",
  game_ready: "Game-ready",
};

export const INSTALL_CATEGORIES = ["position", "situation"] as const;
export type InstallCategory = (typeof INSTALL_CATEGORIES)[number];

export const INSTALL_CATEGORY_LABEL: Record<InstallCategory, string> = {
  position: "By position",
  situation: "By situation",
};

/** Where the Softball IQ tests a player can take on the same thing (shown as a pointer). */
export type InstallIqTrack = "defense" | "baserunning" | "offense" | "battery" | "position";

export type StarterItem = { category: InstallCategory; group: string; title: string; iq?: InstallIqTrack };

const position = (group: string, iq: InstallIqTrack, titles: string[]): StarterItem[] =>
  titles.map((title) => ({ category: "position", group, title, iq }));
const situation = (group: string, iq: InstallIqTrack | undefined, titles: string[]): StarterItem[] =>
  titles.map((title) => ({ category: "situation", group, title, ...(iq ? { iq } : {}) }));

/** The starter checklist a coach can load and then trim or add to. Fastpitch. */
export const STARTER_ITEMS: StarterItem[] = [
  ...position("P", "battery", [
    "Fielding position after the release",
    "Covering first on balls to the right side",
    "Backing up home and third",
    "Comebacker: look the runner back, then throw",
  ]),
  ...position("C", "battery", [
    "Signs and setup for every count",
    "Blocking balls in the dirt",
    "Back-picks to first and third",
    "Bunt coverage and calling who takes it",
    "Pop-ups: turn your back to the field",
  ]),
  ...position("1B", "position", [
    "Footwork at the bag and the stretch",
    "Charging the bunt and when to stay home",
    "Cut-off spot on throws home from right",
  ]),
  ...position("2B", "position", [
    "Covering first on bunts",
    "Double-play feeds and the pivot",
    "Cut-off and relay from right and center",
  ]),
  ...position("SS", "position", [
    "Covering second and third on steals",
    "Double-play feeds and the pivot",
    "Relay from left and center",
  ]),
  ...position("3B", "position", [
    "Charging the bunt and the slap",
    "Cut-off spot on throws home from left",
    "Tag at third on the steal",
  ]),
  ...position("OF", "position", [
    "Drop step and first move on fly balls",
    "Calling the ball and priority",
    "Do-or-die ground balls",
    "Hitting the cut-off",
    "Backing up every base",
  ]),
  ...situation("Bunt defense", "defense", ["Sacrifice bunt, runner on first", "Sacrifice bunt, runners on first and second", "Wheel play"]),
  ...situation("First and third", "defense", ["Runner breaks from first: our call", "Delayed steal"]),
  ...situation("Rundowns", "defense", ["Run her back toward the base she came from", "One throw, tag and get out of the lane"]),
  ...situation("Slap defense", "defense", ["Slapper up, runner on first", "Slapper up, bases empty"]),
  ...situation("Squeeze", "defense", ["Safety squeeze defense", "Suicide squeeze: the pitchout and the tag"]),
  ...situation("Cut-offs and relays", "defense", ["Single to the outfield, runner on second", "Extra-base hit: the double cut"]),
  ...situation("Baserunning", "baserunning", [
    "Leaving on the release",
    "Reading the dropped third strike",
    "Look-back rule: commit and go",
    "Tagging up on fly balls",
  ]),
  ...situation("Rules in play", undefined, ["Infield fly", "Dropped third strike: when she can run", "International tiebreaker inning"]),
  ...situation("Offense", "offense", ["Hit-and-run", "Sacrifice bunt", "Slap with a runner on first", "Signs from the third base coach"]),
];

/** The next status when a coach taps an item: Not started → Taught → Repped → Game-ready → Not started. */
export function nextInstallStatus(status: InstallStatus): InstallStatus {
  return INSTALL_STATUSES[(INSTALL_STATUSES.indexOf(status) + 1) % INSTALL_STATUSES.length];
}

export type InstallProgress = Record<InstallStatus, number> & { total: number; readyPct: number };

/** How many items sit at each status, and the share that is game-ready. */
export function installProgress(items: { status: InstallStatus }[]): InstallProgress {
  const counts = { not_started: 0, taught: 0, repped: 0, game_ready: 0 };
  for (const item of items) counts[item.status] += 1;
  return { ...counts, total: items.length, readyPct: items.length ? Math.round((counts.game_ready / items.length) * 100) : 0 };
}

/** Items grouped by their group name, groups in the order they first appear. */
export function groupInstallItems<T extends { group: string }>(items: T[]): { group: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return [...groups].map(([group, list]) => ({ group, items: list }));
}

const DAY = 86_400_000;

/**
 * The pace to opening day: practices left on the calendar before the first game and how
 * many items still need to be game-ready. `perPractice` is null when there is nothing left
 * to install or no practice to do it in.
 */
export function installPace(
  today: string,
  opener: string | null,
  practiceDates: string[],
  progress: InstallProgress,
): { days: number | null; practices: number; toGo: number; perPractice: number | null } {
  const toGo = progress.total - progress.game_ready;
  if (!opener || opener < today) return { days: null, practices: 0, toGo, perPractice: null };
  const days = Math.round((Date.parse(`${opener}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  const practices = new Set(practiceDates.filter((d) => d >= today && d < opener)).size;
  return { days, practices, toGo, perPractice: toGo > 0 && practices > 0 ? Math.ceil(toGo / practices) : null };
}

// ---------------------------------------------------------------------------
// Practice notes for players
// ---------------------------------------------------------------------------

export const NOTE_LIMITS = { objective: 200, rule_of_day: 200, announcements: 1000, coach_notes: 1000, cue: 120 } as const;

/** Trim a note; blank becomes null, and anything over the limit is an error message. */
export function cleanNote(value: string | null | undefined, limit: number, label: string): string | null | { error: string } {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.length > limit) return { error: `${label} can be at most ${limit} characters.` };
  return v;
}
