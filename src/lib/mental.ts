// The mental game (Phase 1, user 2026-11-08): the Standard tools on her Mental GP
// page. My signals (green / yellow / red), the intensity check and her zone, the
// monthly self-scan, guided breathing and imagery sessions, and the practice
// journal. The G3 Advanced Mental Toughness course lives in advanced-book.ts.
// Original wording, written for fastpitch. No imports, so it runs in unit tests
// (and client components can use it).

// ---------------------------------------------------------------------------
// My signals
// ---------------------------------------------------------------------------

export type SignalField = "green_signs" | "yellow_signs" | "red_signs" | "yellow_release" | "red_release";

export const SIGNALS: { light: "green" | "yellow" | "red"; label: string; signs: SignalField; signsHint: string; release?: SignalField; releaseHint?: string }[] = [
  { light: "green", label: "Green", signs: "green_signs", signsHint: "What it feels like when you're locked in. Loose hands, clear head, seeing the ball…" },
  {
    light: "yellow",
    label: "Yellow",
    signs: "yellow_signs",
    signsHint: "The first signs you're speeding up. Rushing, gripping tight, thinking about the score…",
    release: "yellow_release",
    releaseHint: "A quick release to get back to green: a breath and your cue word.",
  },
  {
    light: "red",
    label: "Red",
    signs: "red_signs",
    signsHint: "What it looks like when it gets away from you. Racing thoughts, short breath, head down…",
    release: "red_release",
    releaseHint: "A bigger reset: step out, a physical release, a long breath out, your cue word.",
  },
];

export const SIGNAL_MAX = 500;

// ---------------------------------------------------------------------------
// Intensity: 1-10, against her zone
// ---------------------------------------------------------------------------

export const INTENSITY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const DEFAULT_ZONE = { low: 6, high: 8 } as const;
export const INTENSITY_CONTEXTS = ["game", "practice", "other"] as const;
export type IntensityContext = (typeof INTENSITY_CONTEXTS)[number];
export const CONTEXT_LABEL: Record<IntensityContext, string> = { game: "Game", practice: "Practice", other: "Other" };
export const ADJUSTMENT_MAX = 200;

export type ZoneStatus = "under" | "in" | "over";

/** Where a level sits against her zone (the default zone when she hasn't set one). */
export function zoneStatus(level: number, zone: { low: number | null; high: number | null } | null): ZoneStatus {
  const low = zone?.low ?? DEFAULT_ZONE.low;
  const high = zone?.high ?? DEFAULT_ZONE.high;
  return level < low ? "under" : level > high ? "over" : "in";
}

/** What to do about it: bring it up, keep it, or bring it down. */
export const ZONE_TIP: Record<ZoneStatus, string> = {
  under: "Bring it up: quick feet, a sharp cue word, energy in your voice and a hard first throw.",
  in: "You're in your zone. Keep your routine and stay there.",
  over: "Bring it down: a long breath out, loose hands and jaw, slow your walk and pick one target.",
};

// ---------------------------------------------------------------------------
// Monthly self-scan: ten skills, 1-5. The order is stored in the database
// (mental_scans.scores); only ever append new skills.
// ---------------------------------------------------------------------------

export const SCAN_SKILLS: { key: string; name: string; prompt: string }[] = [
  { key: "confidence", name: "Confidence", prompt: "I trust my preparation and I want the ball." },
  { key: "focus", name: "Focus", prompt: "I lock in on the next pitch, not the last one." },
  { key: "composure", name: "Composure", prompt: "My body language looks the same after a strikeout as after a hit." },
  { key: "reset", name: "Reset", prompt: "After a mistake I use my reset and I'm ready by the next pitch." },
  { key: "self_talk", name: "Self-talk", prompt: "I talk to myself like I'd talk to a teammate." },
  { key: "breathing", name: "Breathing", prompt: "I use my breath to slow down when the game speeds up." },
  { key: "preparation", name: "Preparation", prompt: "I show up to practice and games with a plan." },
  { key: "effort", name: "Effort", prompt: "My effort doesn't depend on the score or how I feel." },
  { key: "communication", name: "Communication", prompt: "I talk on the field and in the dugout, even when it's tight." },
  { key: "perspective", name: "Perspective", prompt: "I keep the game in perspective and still have fun competing." },
];

export const SCAN_LABELS = ["Not yet", "Sometimes", "Most days", "Usually", "Every time"] as const;
export const SCAN_NOTE_MAX = 500;

/** The month a date belongs to, as its first day ("2026-11-17" -> "2026-11-01"). */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function isValidScan(scores: unknown): scores is number[] {
  return (
    Array.isArray(scores) &&
    scores.length === SCAN_SKILLS.length &&
    scores.every((s) => Number.isInteger(s) && s >= 1 && s <= 5)
  );
}

export function scanAverage(scores: number[]): number {
  return scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
}

/** Her strongest and weakest skills on a scan (ties keep the list order). */
export function scanExtremes(scores: number[]) {
  const ranked = SCAN_SKILLS.map((s, i) => ({ ...s, score: scores[i] ?? 0 }));
  const best = Math.max(...ranked.map((r) => r.score));
  const worst = Math.min(...ranked.map((r) => r.score));
  return { strongest: ranked.filter((r) => r.score === best), workOn: ranked.filter((r) => r.score === worst) };
}

/** Change per skill from one scan to the next (positive = better). */
export function scanChange(previous: number[] | null, current: number[]): (number | null)[] {
  return current.map((s, i) => (previous && previous[i] ? s - previous[i] : null));
}

// ---------------------------------------------------------------------------
// Guided sessions: breathing patterns and imagery scripts. Each one is a training
// drill in the library (drills.guide = slug, seeded by migration 20261109000100),
// so she can make it a routine that shows in TWIS.
// ---------------------------------------------------------------------------

export type BreathPattern = { inhale: number; hold?: number; exhale: number; holdOut?: number; rounds: number };

export type GuidedSession = {
  slug: string;
  title: string;
  kind: "breathing" | "imagery";
  minutes: number;
  /** one line for the list */
  summary: string;
  /** read before starting */
  intro: string[];
  /** breathing: the pattern the pacer follows */
  pattern?: BreathPattern;
  /** imagery: what to see, step by step, with time to see it */
  steps?: { text: string; seconds: number }[];
  /** the takeaway at the end */
  close: string;
};

export const GUIDED_SESSIONS: GuidedSession[] = [
  {
    slug: "reset-breath",
    title: "Reset Breath",
    kind: "breathing",
    minutes: 2,
    summary: "In for four, out for six. The breath you use between pitches.",
    intro: [
      "Stand or sit tall and let your shoulders drop. Breathe in through your nose and let your belly fill, not your chest.",
      "The breath out is longer than the breath in. That longer exhale is what slows you down.",
    ],
    pattern: { inhale: 4, exhale: 6, rounds: 8 },
    close: "Use one of these before every pitch today: in for four, out for six, then pick your target.",
  },
  {
    slug: "box-breathing",
    title: "Box Breathing",
    kind: "breathing",
    minutes: 2,
    summary: "In, hold, out, hold. Settles you before a game or a big at-bat.",
    intro: [
      "Four equal sides: breathe in for four, hold for four, breathe out for four, hold for four.",
      "Keep your hands and jaw loose. If a count feels long, make all four sides shorter.",
    ],
    pattern: { inhale: 4, hold: 4, exhale: 4, holdOut: 4, rounds: 6 },
    close: "Use it in the car, in the dugout before warm-ups, or on deck when the game feels fast.",
  },
  {
    slug: "red-light-breath",
    title: "Red-Light Breath",
    kind: "breathing",
    minutes: 2,
    summary: "A long, slow breath out to come back from red.",
    intro: [
      "When you're at red, your breathing gets short and high in your chest. This brings it back down.",
      "Breathe in for four, hold for two, then let it out slowly for eight, like you're fogging up a window.",
    ],
    pattern: { inhale: 4, hold: 2, exhale: 8, rounds: 6 },
    close: "At red: step out, use your release, then one or two of these breaths before you step back in.",
  },
  {
    slug: "game-face",
    title: "Game Face",
    kind: "imagery",
    minutes: 3,
    summary: "See your pre-game from arrival to first pitch and walk on the field at green.",
    intro: [
      "Close your eyes or look at one spot. Take two reset breaths.",
      "See everything in detail: the field, the sounds, the feel of your gear. See it going right, at game speed.",
    ],
    steps: [
      { text: "You pull up to the field. See the diamond, the dugout, your team getting out of the cars. You feel ready, not rushed.", seconds: 25 },
      { text: "You're warming up. Your legs feel loose, your throws are crisp, your partner's glove pops on every catch.", seconds: 30 },
      { text: "Infield and outfield. The ball finds your glove, your feet are quick, your throws are on the chest.", seconds: 30 },
      { text: "Team huddle. You hear your coach, you look at your teammates, you feel the energy.", seconds: 20 },
      { text: "You run onto the field for the first pitch. Head up, quick feet, your cue word in your head. You're at green.", seconds: 30 },
      { text: "First pitch. You take your prep step and you want the ball hit to you.", seconds: 25 },
    ],
    close: "Do this the night before or the morning of a game. The real pre-game will feel familiar.",
  },
  {
    slug: "confident-at-bat",
    title: "Confident At-Bat",
    kind: "imagery",
    minutes: 3,
    summary: "See a full at-bat, routine to contact, including a two-strike battle.",
    intro: [
      "Take two reset breaths. You're going to see two at-bats: one where you get your pitch, and one where you battle.",
      "See it from your own eyes, in the box, at game speed.",
    ],
    steps: [
      { text: "On deck. You time the pitcher, you see her release, you take a few swings on time.", seconds: 25 },
      { text: "You walk to the box. Your routine: a breath, a look at your coach, your cue word.", seconds: 20 },
      { text: "You dig in. You see her start her motion and you see the ball out of her hand early.", seconds: 25 },
      { text: "It's your pitch. You stay through it and drive it hard. Feel the contact. Hear it.", seconds: 25 },
      { text: "Second at-bat. You're down 0-2. You step out, breathe, and widen your zone a little.", seconds: 25 },
      { text: "You foul off a tough pitch. You lay off one in the dirt. You put the next one in play hard.", seconds: 30 },
    ],
    close: "Whatever happens in the real at-bat, your routine is the same. That's the part you own.",
  },
  {
    slug: "lock-in-inning",
    title: "Lock-In Inning",
    kind: "imagery",
    minutes: 3,
    summary: "See a full inning on defense or in the circle, including the reset after a mistake.",
    intro: [
      "Take two reset breaths. See the field from your position. If you pitch, see it from the circle.",
      "You'll see a mistake in this inning on purpose. Tough players practice the reset too.",
    ],
    steps: [
      { text: "You take your spot. You check the outs, the count, where the runners are, and where the ball should go.", seconds: 25 },
      { text: "Every pitch: your prep step, eyes on the hitting zone. You want the ball.", seconds: 25 },
      { text: "A hard ground ball. You stay down, field it clean and make a strong throw. One out.", seconds: 25 },
      { text: "Next play doesn't go your way: a bobble, a walk or a hit. See it happen.", seconds: 20 },
      { text: "Your release, a long breath out, your cue word. You're back to green before the next pitch.", seconds: 30 },
      { text: "The next ball comes to you and you make the play. You finish the inning and sprint off the field.", seconds: 25 },
    ],
    close: "The reset you just saw is the one to use for real. Rep it here and it shows up in games.",
  },
];

export function sessionBySlug(slug: string): GuidedSession | undefined {
  return GUIDED_SESSIONS.find((s) => s.slug === slug);
}

/** Seconds a breathing pattern takes from start to finish. */
export function patternSeconds(p: BreathPattern): number {
  return (p.inhale + (p.hold ?? 0) + p.exhale + (p.holdOut ?? 0)) * p.rounds;
}

// ---------------------------------------------------------------------------
// Practice journal
// ---------------------------------------------------------------------------

export const JOURNAL_LIMITS = { purpose: 200, worked: 500, fix: 500, lookBack: 1000 } as const;

export const JOURNAL_PROMPTS = {
  purpose: { label: "Before: my purpose today", hint: "One thing you'll get better at, e.g. \"Stay through the ball on the outside pitch\"" },
  worked: { label: "After: what worked", hint: "Be specific. What did you do well?" },
  fix: { label: "After: what I'll fix", hint: "One thing for next time, and how" },
  lookBack: { label: "This week, looking back", hint: "What got better this week? What's the focus next week?" },
} as const;
