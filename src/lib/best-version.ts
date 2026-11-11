// The Best Version of You (user, 2026-11-10): the top of every player's Goals page. The
// user's framework, in our words: what she wants (her roadmap), what it costs (her time),
// whether she'll pay the price, and whether she'd want to be her own teammate. Then the
// 15 Minutes a Day Personal Challenge: what she'll do for fifteen minutes on her off days.
// Her answers live in public.player_best_version. No imports, so it runs in unit tests and
// client code.

export const BEST_VERSION_TITLE = "The Best Version of You";
export const BEST_VERSION_GOAL = "The goal: work to be the best version of yourself.";

export type BestVersionPrompt = { key: string; question: string; note: string };

export const BEST_VERSION_PROMPTS: BestVersionPrompt[] = [
  {
    key: "want",
    question: "What do you want as a player?",
    note: "Build your own roadmap: where you are now, where you want to go, and the steps in between.",
  },
  {
    key: "cost",
    question: "What is it going to cost you?",
    note: "Your most valuable resource is your time. There's no do-over for preparation or for practice.",
  },
  {
    key: "price",
    question: "Are you willing to pay the price of admission?",
    note: "If you don't sacrifice now for what you want later, what you want later becomes the sacrifice.",
  },
  {
    key: "teammate",
    question: "Would I want to be my teammate?",
    note: "Be honest. Then be the teammate you'd want next to you.",
  },
];

export const CHALLENGE = {
  key: "fifteen",
  title: "15 Minutes a Day Personal Challenge",
  question: "What can I do for fifteen minutes on my off days to be my best?",
  ideas: [
    "Tee work: a set number of quality swings",
    "A throwing or wall-ball routine",
    "Footwork, ladder or agility work",
    "A core and band circuit",
    "See your next game: walk through your at-bats and your plays in the field",
  ],
};

export const BEST_VERSION_KEYS = [...BEST_VERSION_PROMPTS.map((p) => p.key), CHALLENGE.key];
export const BEST_VERSION_MAX = 1000;

export type BestVersionAnswers = Record<string, string>;

/** Her answers from a form: only the known keys, trimmed and capped; empty ones left out. */
export function cleanBestVersion(input: Record<string, unknown>): BestVersionAnswers {
  const out: BestVersionAnswers = {};
  for (const key of BEST_VERSION_KEYS) {
    const v = typeof input[key] === "string" ? (input[key] as string).replace(/\s+\n/g, "\n").trim().slice(0, BEST_VERSION_MAX) : "";
    if (v) out[key] = v;
  }
  return out;
}
