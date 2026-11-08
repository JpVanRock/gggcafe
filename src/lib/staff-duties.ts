// Coaching staff duty matrix and staff standards (Coaches Dugout → Roster → Staff duties).
// No imports: shared by server and client code and unit-tested with node --test.

export const DUTY_PHASES = ["practice", "pregame", "game", "postgame", "season"] as const;
export type DutyPhase = (typeof DUTY_PHASES)[number];

export const DUTY_PHASE_LABEL: Record<DutyPhase, string> = {
  practice: "Practice stations",
  pregame: "Before the game",
  game: "During the game",
  postgame: "After the game",
  season: "All season",
};

/** The starter matrix a head coach loads, then names an owner for each line. */
export const STARTER_DUTIES: { phase: DutyPhase; duty: string }[] = [
  { phase: "practice", duty: "Infield station" },
  { phase: "practice", duty: "Outfield station" },
  { phase: "practice", duty: "Pitchers & catchers" },
  { phase: "practice", duty: "Hitting station" },
  { phase: "pregame", duty: "Equipment & field check" },
  { phase: "pregame", duty: "Team warm-up" },
  { phase: "pregame", duty: "Pitcher & catcher warm-up" },
  { phase: "pregame", duty: "Lineup card & plate meeting" },
  { phase: "game", duty: "Third-base coach" },
  { phase: "game", duty: "First-base coach" },
  { phase: "game", duty: "Keep the book" },
  { phase: "game", duty: "Pitch chart" },
  { phase: "game", duty: "Video" },
  { phase: "postgame", duty: "Equipment & dugout clean-up" },
  { phase: "postgame", duty: "Box score into GGG.Cafe" },
  { phase: "postgame", duty: "Notes for the next practice" },
  { phase: "season", duty: "Umpires & scheduling" },
  { phase: "season", duty: "Travel & hotels" },
  { phase: "season", duty: "Team meals" },
  { phase: "season", duty: "Uniforms & gear" },
];

/** Starter staff commitment, in our own words; the head coach edits it. */
export const STARTER_COMMITMENT = [
  "We are on the field before the players and leave after the last one is picked up.",
  "We teach with energy and correct with respect. No yelling at a player for a physical mistake.",
  "We speak with one voice in front of the team; we disagree in private.",
  "We model the standards we ask of the players: on time, prepared, phones away.",
  "We never discuss one player with another player or her family.",
  "Safety first: we know the emergency plan and where the medical cards are.",
];

/** Starter checklist for every coach before practice starts. */
export const STARTER_PRE_PRACTICE = [
  "Read the practice plan and know your station and time block",
  "Equipment for your station is out and set up",
  "Field checked: holes, wet spots, loose gear",
  "Water and first-aid kit at the dugout",
  "Know who is out today and why",
];

/** Lines from a textarea: trimmed, blanks dropped, at most `max` of up to `len` characters. */
export function cleanLines(raw: string, max: number, len: number): string[] | { error: string } {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > max) return { error: `Keep it to ${max} lines.` };
  if (lines.some((l) => l.length > len)) return { error: `Keep each line to ${len} characters.` };
  return lines;
}

/** Game-day jobs for a lineup from the matrix's "during the game" lines that have an owner. */
export function gameJobsFromDuties(duties: { phase: DutyPhase; duty: string; owner: string | null }[]): { job: string; who: string }[] {
  return duties.filter((d) => d.phase === "game" && d.owner).map((d) => ({ job: d.duty, who: d.owner! }));
}
