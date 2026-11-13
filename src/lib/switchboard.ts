// The Switchboard (user, 2026-11-12): a head coach turns parts of the site on or off for
// their team, in three groups: Players, Parents and Mentors. Everything is on until turned
// off (table team_features_off: a row = off). A player on more than one team loses a feature
// when any of her teams turns it off. Off hides it on the site and stops new posts; nothing
// saved is deleted, and turning it back on brings it all back. Coaches always see everything.
// No imports, so client components and unit tests can use it.

export type Audience = "players" | "parents" | "mentors";

export const AUDIENCES: { key: Audience; label: string; note: string }[] = [
  { key: "players", label: "Players", note: "What players see on their own pages. Parents viewing as their daughter see the same." },
  { key: "parents", label: "Parents", note: "What approved parents see on their family page." },
  { key: "mentors", label: "Mentors", note: "What mentors and skill coaches can do with your players." },
];

export const SWITCHES = [
  // players: her menu boards and section pages
  { key: "player.goals", audience: "players", label: "Goals", detail: "Harada or SMART goals and The Best Version of You" },
  { key: "player.pop", audience: "players", label: "Pop Report", detail: "Her profile, stats, measurements and hitting style" },
  { key: "player.mental", audience: "players", label: "Mental GP", detail: "Game plan, lessons, signals, self-scan, guided sessions, practice journal" },
  { key: "player.journal", audience: "players", label: "My Journal", detail: "Notes and voice memos from mentor sessions (a pill in Mental GP; off with it too)" },
  { key: "player.training", audience: "players", label: "Performance Training", detail: "Routines, workouts, testing results, bullpens" },
  { key: "player.iq", audience: "players", label: "Softball IQ", detail: "IQ tests, Golden Gloves, Keep the Book, team quizzes" },
  { key: "player.trophies", audience: "players", label: "Trophy Room", detail: "Rings, Golden Gloves, MVP badges, achievements" },
  { key: "player.leaderboard", audience: "players", label: "Leaderboard", detail: "Offseason points, Player of the Week, squads" },
  { key: "player.activity", audience: "players", label: "+ Activity", detail: "Logging her own workouts and sessions for points" },
  { key: "player.team", audience: "players", label: "Team page", detail: "Standards, culture, hitting philosophy, throwing program, pledge, spotlights" },
  { key: "player.yearbook", audience: "players", label: "Yearbook", detail: "The team's season photos (G3 Advanced)" },
  // parents: their family page
  { key: "parent.budget", audience: "parents", label: "Team Budget", detail: "Team totals, expenses and tournament credits, view only" },
  { key: "parent.packet", audience: "parents", label: "Welcome packet", detail: "Your letter, team policies and tips" },
  { key: "parent.questionnaire", audience: "parents", label: "Preseason questionnaire", detail: "Sizes, numbers, positions, goals" },
  { key: "parent.view_as", audience: "parents", label: "View as player", detail: "Her player pages, read only" },
  { key: "parent.yearbook", audience: "parents", label: "Yearbook", detail: "Season photos, and adding their own" },
  // mentors: what they can do with your players
  { key: "mentor.messages", audience: "mentors", label: "Message players", detail: "Messages, photos and drills to players" },
  { key: "mentor.training", audience: "mentors", label: "Add training", detail: "Sessions on players' weeks (TWIS)" },
  { key: "mentor.notes", audience: "mentors", label: "Focus areas & notes", detail: "Working with the coaches about a player or the team" },
  { key: "mentor.goals", audience: "mentors", label: "See Goals", detail: "A player's goals and The Best Version of You" },
  { key: "mentor.pop", audience: "mentors", label: "See Pop Report", detail: "Her profile, stats and measurements" },
  { key: "mentor.mental", audience: "mentors", label: "See Mental GP", detail: "Her game plan, signals and self-scans" },
  { key: "mentor.journal", audience: "mentors", label: "Shared journal entries", detail: "Entries a player chooses to share from My Journal" },
] as const satisfies readonly { key: string; audience: Audience; label: string; detail: string }[];

export type SwitchKey = (typeof SWITCHES)[number]["key"];

/** Shown on the Switchboard but not switchable, and why. */
export const ALWAYS_ON: { audience: Audience; label: string; why: string }[] = [
  { audience: "players", label: "This Week in Softball", why: "The schedule every player needs." },
  { audience: "players", label: "Messages from mentors", why: "Set by Message players, under Mentors." },
  { audience: "parents", label: "Medical & emergency card", why: "Safety: coaches need it at games." },
  { audience: "parents", label: "Her login and parental consent", why: "Privacy law for players under 13." },
  { audience: "parents", label: "Her mentors", why: "Parents approve and oversee who works with their daughter." },
];

export function isSwitchKey(value: unknown): value is SwitchKey {
  return SWITCHES.some((s) => s.key === value);
}

export function switchesFor(audience: Audience) {
  return SWITCHES.filter((s) => s.audience === audience);
}

export function switchLabel(key: SwitchKey): string {
  return SWITCHES.find((s) => s.key === key)!.label;
}

/** A player's section folder → its switch (pages under it follow it too). */
export const SECTION_SWITCH: Record<string, SwitchKey> = {
  goals: "player.goals",
  pop: "player.pop",
  mental: "player.mental",
  training: "player.training",
  iq: "player.iq",
  trophies: "player.trophies",
  leaderboard: "player.leaderboard",
  log: "player.activity",
  team: "player.team",
  spotlight: "player.team",
  yearbook: "player.yearbook",
};

/** Off for a player on several teams: off on any of them. `rows` = the off switches of her teams. */
export function offForPlayer(rows: readonly { feature: string }[]): Set<SwitchKey> {
  return new Set(rows.map((r) => r.feature).filter(isSwitchKey));
}
