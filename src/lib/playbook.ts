// Team playbook & scouting (Coaches Dugout → Playbook, GameDay → Depth chart).
// No imports: shared by server and client code and unit-tested with node --test.

// ---------------------------------------------------------------------------
// Depth chart
// ---------------------------------------------------------------------------

export const DEPTH_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
export type DepthPosition = (typeof DEPTH_POSITIONS)[number];

/** position -> player ids, best first */
export type DepthChart = Partial<Record<DepthPosition, string[]>>;

/**
 * A defensive rotation from the depth chart: positions with the fewest options fill
 * first (usually P and C), each taking her highest-ranked player who is available and
 * not already placed. Everyone left over sits ("Sub"); positions nobody on the depth
 * chart can play stay open.
 */
export function suggestDefense(depth: DepthChart, players: string[]): Record<string, DepthPosition | "Sub"> {
  const available = new Set(players);
  const order = [...DEPTH_POSITIONS].sort(
    (a, b) =>
      (depth[a] ?? []).filter((id) => available.has(id)).length - (depth[b] ?? []).filter((id) => available.has(id)).length ||
      DEPTH_POSITIONS.indexOf(a) - DEPTH_POSITIONS.indexOf(b),
  );
  const out: Record<string, DepthPosition | "Sub"> = {};
  for (const pos of order) {
    const pick = (depth[pos] ?? []).find((id) => available.has(id) && !(id in out));
    if (pick) out[pick] = pos;
  }
  for (const id of players) if (!(id in out)) out[id] = "Sub";
  return out;
}

// ---------------------------------------------------------------------------
// Plays (the call sheet)
// ---------------------------------------------------------------------------

export const PLAY_CATEGORIES = [
  "defensive_alignment", "bunt_defense", "first_and_third", "cutoff_relay", "rundown",
  "short_game_offense", "baserunning", "pickoff", "pitch_calling", "other",
] as const;
export type PlayCategory = (typeof PLAY_CATEGORIES)[number];

export const PLAY_CATEGORY_LABEL: Record<PlayCategory, string> = {
  defensive_alignment: "Infield & outfield depths",
  bunt_defense: "Bunt & slap defense",
  first_and_third: "First and third",
  cutoff_relay: "Cut-offs & relays",
  rundown: "Rundowns",
  short_game_offense: "Offensive plays",
  baserunning: "Baserunning",
  pickoff: "Back-picks",
  pitch_calling: "Pitch calling",
  other: "Other",
};

/** A reminder shown on the play form: name the call and what everyone does, never how a sign is given. */
export const SIGN_RULE = "Name the call and what everyone does. Never write how a sign is given (touches, indicators, wipe-offs).";

// ---------------------------------------------------------------------------
// Team quizzes
// ---------------------------------------------------------------------------

/** One choice per line, blank lines dropped; 2-5 choices, each up to 120 characters. */
export function parseChoices(raw: string): string[] | { error: string } {
  const choices = raw
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  if (choices.length < 2 || choices.length > 5) return { error: "Write 2 to 5 answer choices, one per line." };
  if (choices.some((c) => c.length > 120)) return { error: "Keep each choice to 120 characters." };
  if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) return { error: "Two choices are the same." };
  return choices;
}

export type QuizAnswer = { first_correct: boolean | null; is_correct: boolean | null };

/** Her progress on a quiz: answered, first-try score, and whether any answer is still wrong. */
export function quizScore(answers: QuizAnswer[]) {
  const answered = answers.filter((a) => a.first_correct !== null);
  const firstTry = answered.filter((a) => a.first_correct).length;
  return {
    total: answers.length,
    answered: answered.length,
    firstTry,
    pct: answers.length ? Math.round((firstTry / answers.length) * 100) : 0,
    toFix: answered.filter((a) => !a.is_correct).length,
    done: answers.length > 0 && answered.length === answers.length,
  };
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

/** A deterministic shuffle (so a deck reshuffles the same way for the same seed). */
export function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scouting checklist (fastpitch)
// ---------------------------------------------------------------------------

export type ScoutCategory =
  | "team_overview" | "hitter_tendencies" | "pitcher_tendencies" | "defense" | "baserunning" | "coaching_tendencies";

export const SCOUT_CATEGORY_LABEL: Record<ScoutCategory | "signs_and_signals" | "other", string> = {
  team_overview: "Team overview",
  hitter_tendencies: "Hitters",
  pitcher_tendencies: "Pitchers",
  defense: "Defense",
  baserunning: "Baserunning",
  coaching_tendencies: "Coaching tendencies",
  signs_and_signals: "Signs",
  other: "Other",
};

export type ScoutPrompt = { key: string; category: ScoutCategory; title: string; prompt: string };

/** The guided checklist: what to watch for against a fastpitch opponent. */
export const SCOUT_PROMPTS: ScoutPrompt[] = [
  { key: "overview", category: "team_overview", title: "How they score", prompt: "How do they score most of their runs: power, short game, speed, walks?" },
  { key: "top-hitters", category: "hitter_tendencies", title: "Hitters to watch", prompt: "Who are the two or three hitters that hurt you, and where do they hit it?" },
  { key: "slappers", category: "hitter_tendencies", title: "Slappers", prompt: "Who slaps? Where does she start in the box, does she soft slap, power slap or bunt, and does she do it with two strikes?" },
  { key: "short-game", category: "hitter_tendencies", title: "Short game", prompt: "Who bunts for a hit, who sacrifices, and how early in the count? Where should our corners play?" },
  { key: "two-strikes", category: "hitter_tendencies", title: "Two-strike approach", prompt: "Do they choke up, shorten up or chase up with two strikes?" },
  { key: "pitch-mix", category: "pitcher_tendencies", title: "Pitch mix", prompt: "What does each pitcher throw, what's her out pitch, and what does she go to when she's behind?" },
  { key: "first-pitch", category: "pitcher_tendencies", title: "First pitch", prompt: "Does she start hitters with a strike? Which pitch, and where?" },
  { key: "command", category: "pitcher_tendencies", title: "Speed and command", prompt: "How hard does she throw, does she walk people, and does she tire late?" },
  { key: "catcher", category: "defense", title: "Catcher", prompt: "How strong and quick is her arm? Does she back-pick at first or third, and when?" },
  { key: "corners", category: "defense", title: "Corners", prompt: "How deep do the corners play, and do they crash on bunt looks?" },
  { key: "first-third-d", category: "defense", title: "First-and-third defense", prompt: "When we send the runner from first, what do they do: throw through, cut, look the runner back?" },
  { key: "outfield", category: "defense", title: "Outfield", prompt: "Who has an arm, who's slow to the ball, and how deep do they play?" },
  { key: "steals", category: "baserunning", title: "Stealing", prompt: "Do they run on the first pitch, delay steal, or run on the catcher's throw back?" },
  { key: "aggression", category: "baserunning", title: "Aggression", prompt: "Do they take the extra base, run on dropped third strikes, test the look-back rule?" },
  { key: "first-third-o", category: "baserunning", title: "First and third (their offense)", prompt: "With runners on first and third, does the runner from first go? Does the runner on third break?" },
  { key: "coach-calls", category: "coaching_tendencies", title: "When they call plays", prompt: "When do they bunt, squeeze, hit-and-run or steal: score, inning, count?" },
];

export const CONFIDENCE_LABEL: Record<number, string> = {
  1: "Hunch",
  2: "Saw it once",
  3: "Saw it a few times",
  4: "Saw it often",
  5: "Every time",
};
