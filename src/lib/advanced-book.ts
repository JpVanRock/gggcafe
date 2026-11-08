// G3 Advanced (Level 2): the player's advanced book on how to compete.
//
// Paid content: import this file from SERVER code only (server components, server
// actions), never from a "use client" file, so a player without G3 Advanced never
// gets the text in her browser. Pages pass one chapter at a time to client pieces.
//
// The book is a list of chapters in reading order. Each chapter has a pre-filled
// foundation (why it matters, and the habits that make up the standard) that the
// player builds on with her own habits and notes. To add a chapter, add an entry
// to CHAPTERS with a new, permanent slug: her saved work is keyed by slug, and
// chapter numbers come from the order, so chapters can be added anywhere.
// A chapter with status "coming" is listed and open for her own notes, but has no
// foundation yet and doesn't count toward her progress.
// A chapter with `requires` (e.g. the Pitching chapter) exists only for players a
// coach has confirmed at that position: for everyone else it isn't listed,
// numbered, counted or readable. Always work from visibleChapters(...).
// Written from the user's "How to Compete?" sheet (its six underlined headings
// are Chapters 1-6), in our own words. No imports, so it runs in unit tests.

export const DEFAULT_BOOK_TITLE = "How to Cook";
export const BOOK_THEME = "How to Compete";
export const BOOK_TITLE_MAX = 60;
export const MY_HABITS_MAX = 12;
export const MY_HABIT_LENGTH = 160;
export const NOTES_MAX = 2000;

export type Habit = { key: string; text: string; detail?: string };

export type BookChapter = {
  /** permanent: her work is saved under it */
  slug: string;
  /** only for players confirmed at this position by a coach */
  requires?: { position: "P" | "C" | "1B" | "2B" | "3B" | "SS" | "LF" | "CF" | "RF" };
  /** a short tag over the title, e.g. "Focused Skill" */
  kicker?: string;
  kind: "intro" | "chapter";
  status: "ready" | "coming";
  title: string;
  /** the question the chapter answers */
  question?: string;
  /** one line for the table of contents */
  summary: string;
  /** why it matters */
  why?: string[];
  /** the foundation: habits she starts with */
  habits?: Habit[];
};

export const CHAPTERS: BookChapter[] = [
  {
    slug: "good-habits",
    kind: "intro",
    status: "ready",
    title: "It Starts with Good Habits",
    summary: "Competing isn't a switch you flip in a big moment. It's built from habits.",
    why: [
      "Competing isn't something you turn on when the game gets close. By then it's too late to decide who you are. What shows up in a tight spot is whatever you've practiced: how you warm up, how you take your throws between innings, what you do in the on-deck circle, how you handle a strikeout.",
      "That's what this book is about. Every chapter covers one part of the game where players either compete or just go through the motions, and every chapter starts with a foundation: the habits that make up the standard.",
      "The foundation is where you start, not where you stop. Mark the habits you already own. Add your own. Write down what works for you. Over time this becomes your book, and you can rename it to make it yours.",
      "New chapters will keep coming: your position, your hitting approach, mental toughness. Leveling up isn't a test you pass once. It's a book you keep writing.",
    ],
  },
  {
    slug: "pre-game",
    kind: "chapter",
    status: "ready",
    title: "Pre-Game",
    question: "How do we treat getting loose?",
    summary: "Is there meaning to your warm-up, or are you just throwing and lazily stretching?",
    why: [
      "Your warm-up is the first rep of the game. If it's lazy, your first inning usually is too.",
      "Getting loose with purpose means every throw has a target, every stretch has a reason, and by the time the umpire says play ball, your body and your head are already in the game.",
    ],
    habits: [
      { key: "pre-target", text: "Every warm-up throw has a target.", detail: "Hit your partner's chest or glove side. Footwork and release like it's a game throw." },
      { key: "pre-stretch", text: "Stretch with intent.", detail: "Move through the full range. Stretching isn't the time to stand around and talk." },
      { key: "pre-speed", text: "Finish the warm-up at game speed.", detail: "Quick transfers, game-speed throws and first-step reads before the first pitch." },
      { key: "pre-ready", text: "Know your job before the first pitch.", detail: "The lineup, the opponent, your position, what you want to do in your first at-bat." },
    ],
  },
  {
    slug: "between-innings",
    kind: "chapter",
    status: "ready",
    title: "Between Innings",
    question: "How am I treating these reps?",
    summary: "6 or 7 innings × 3 throws = 18 to 21 extra reps every game. Use them or waste them.",
    why: [
      "Do the math: 6 or 7 innings, about 3 throws each. That's 18 to 21 reps a game you get for free. Over a season, it's hundreds of throws.",
      "Players who compete treat them like game reps. Players who don't lob them and talk. Same time on the field, completely different result.",
    ],
    habits: [
      { key: "inn-sprint", text: "Sprint out and be ready for the first throw." },
      { key: "inn-game-speed", text: "Every throw is at game speed, to a target.", detail: "How are my throws? Accurate, on a line, good footwork?" },
      { key: "inn-live", text: "Take warm-up ground balls like they're live.", detail: "Outfielders: get loose with purpose and get your legs ready." },
      { key: "inn-reset", text: "Use the last throw to reset.", detail: "Outs, score, who's up. Know the situation before the first pitch of the half-inning." },
    ],
  },
  {
    slug: "on-deck",
    kind: "chapter",
    status: "ready",
    title: "On-Deck Reps",
    question: "What am I doing to prepare for my at-bat?",
    summary: "Timing the pitcher, talking to your base runner, reading pitcher tendencies.",
    why: [
      "The on-deck circle is where your at-bat starts. The best hitters walk to the plate already timed up, with a plan, knowing the situation.",
      "Swinging a bat while looking at the crowd isn't preparing. Watching the pitcher is.",
    ],
    habits: [
      { key: "deck-timing", text: "Time the pitcher.", detail: "Take your swings in rhythm with her delivery, so you're on time for pitch one." },
      { key: "deck-tendencies", text: "Read her tendencies.", detail: "Does she start with a strike? What does she throw when she's ahead? When she's behind?" },
      { key: "deck-runner", text: "Talk to your base runner.", detail: "Know who's on, the signs, and what you're trying to do together." },
      { key: "deck-plan", text: "Walk up with a plan.", detail: "Count, outs, runners, what you're looking for. Decide before you're in the box." },
    ],
  },
  {
    slug: "response-to-failure",
    kind: "chapter",
    status: "ready",
    title: "Response to Failure",
    question: "How do I respond to a strikeout, an error, a bad call, giving up a bomb?",
    summary: "Everyone fails in this game. Competitors recover fast.",
    why: [
      "Softball is a game of failure. You'll strike out, boot a ground ball, get squeezed by an umpire, give up a home run. That's not the question. The question is what you do in the next ten seconds.",
      "The next pitch doesn't care about the last one. Competitors have a way to let it go and get back to work.",
    ],
    habits: [
      { key: "fail-reset", text: "Have a reset routine.", detail: "A breath, a physical cue (wipe the dirt, tap the glove), one word that brings you back." },
      { key: "fail-body", text: "Body language doesn't change.", detail: "Head up, shoulders back. No slumping, no glaring at the umpire." },
      { key: "fail-learn", text: "Take one lesson, then let it go.", detail: "What's the one thing to fix? Know it, then leave the mistake behind before the next pitch." },
      { key: "fail-team", text: "Pick up a teammate who just failed.", detail: "That's competing too." },
    ],
  },
  {
    slug: "communication",
    kind: "chapter",
    status: "ready",
    title: "Communication",
    question: "Am I talking between pitches, helping teammates, directing cut-offs?",
    summary: "A quiet defense is a confused defense.",
    why: [
      "Talking is a skill, and it wins games. Every pitch, everyone on the field should know the outs, where the play is and who's covering.",
      "Loud teammates are good teammates. If you know something, say it.",
    ],
    habits: [
      { key: "talk-pitch", text: "Talk before every pitch.", detail: "Outs, where the play is, who covers on a steal or a bunt." },
      { key: "talk-ball", text: "Call the ball, loud and early.", detail: "Pop-ups, balls in the gap, plays between two fielders." },
      { key: "talk-cutoff", text: "Direct the cut-off with your voice.", detail: "\"Cut!\" \"Home!\" \"Three!\" Tell the cut what to do with it." },
      { key: "talk-lift", text: "Keep your teammates up.", detail: "Encourage after a mistake, celebrate the little things." },
    ],
  },
  {
    slug: "every-pitch",
    kind: "chapter",
    status: "ready",
    title: "Regardless of Circumstances",
    question: "How am I feeling today, and does it matter?",
    summary: "Tired, sore, behind by six or having a bad day: does every pitch still matter?",
    why: [
      "Some days you'll feel great. Some days you won't. Competing means your effort doesn't depend on how you feel, the score or how your last at-bat went.",
      "Every practice rep and every pitch matters, because the habits you build on the bad days are the ones that show up in the big games.",
    ],
    habits: [
      { key: "every-finish", text: "Every practice rep matters. Finish every drill." },
      { key: "every-sprint", text: "Sprint on and off the field." },
      { key: "every-backup", text: "Back up bases and take your prep step every pitch.", detail: "Move with the hitter's tendencies before the ball is hit." },
      { key: "every-pitch", text: "Every pitch matters.", detail: "Up big, down big, first inning or last." },
    ],
  },
  {
    slug: "pitching",
    kind: "chapter",
    status: "ready",
    requires: { position: "P" },
    kicker: "Focused Skill",
    title: "Pitching: My Best Is Better",
    question: "Am I mastering a few simple things, or trying to throw everything?",
    summary: "Focus on mastering a few simple things: one delivery, pitches that tunnel, and a batter who's always guessing.",
    why: [
      "You don't need a dozen pitches. You need a few you command, thrown from the same delivery, that look alike until it's too late. My best is better: get great at a few simple things before you add more.",
      "Hitters hit what they can predict. Location, spin and change of speed are how you keep them off balance, pitch after pitch.",
    ],
    habits: [
      { key: "pitch-delivery", text: "The same delivery for every pitch.", detail: "Same tempo, arm path and finish, so the batter can't read the pitch from your motion." },
      { key: "pitch-tunnel", text: "My change-up tunnels with my best pitches.", detail: "It starts on the same line as your fastball and movement pitches, then dies." },
      { key: "pitch-axis", text: "Pitches that share a spin axis.", detail: "Two or more pitches with similar spin look the same out of your hand." },
      { key: "pitch-guessing", text: "The batter is guessing.", detail: "If she's sitting on a pitch and getting it, something you're doing is predictable." },
      {
        key: "pitch-calling",
        text: "Pitch calling that doesn't repeat.",
        detail: "Work with your catcher and coach so sequences don't fall into patterns: first pitch, two strikes, ahead or behind.",
      },
      { key: "pitch-heights", text: "Two moving pitches at three heights each.", detail: "Command each one up, middle and low in the zone." },
      { key: "pitch-tools", text: "Location, spin, change of speed.", detail: "The three tools that keep batters off balance. Know which one you're using on every pitch." },
    ],
  },
  {
    slug: "my-position",
    kind: "chapter",
    status: "coming",
    title: "My Position",
    summary: "How to compete at your position. Coming soon.",
  },
  {
    slug: "hitting-approach",
    kind: "chapter",
    status: "coming",
    title: "Hitting Approach",
    summary: "Your plan at the plate. Coming soon.",
  },
  {
    slug: "mental-toughness",
    kind: "chapter",
    status: "coming",
    title: "Mental Toughness",
    summary: "Staying strong when the game gets hard. Coming soon.",
  },
];

/** Her book: every chapter, minus position chapters for positions a coach hasn't confirmed her at. */
export function visibleChapters(confirmedPositions: string[]): BookChapter[] {
  return CHAPTERS.filter((c) => !c.requires || confirmedPositions.includes(c.requires.position));
}

/** Chapter numbers come from reading order in her book (the introduction isn't numbered). */
export function chapterNumber(slug: string, chapters: BookChapter[] = visibleChapters([])): number | null {
  const numbered = chapters.filter((c) => c.kind === "chapter");
  const i = numbered.findIndex((c) => c.slug === slug);
  return i < 0 ? null : i + 1;
}

export function chapterLabel(c: BookChapter, chapters: BookChapter[] = visibleChapters([])) {
  return c.kind === "intro" ? "Introduction" : `Chapter ${chapterNumber(c.slug, chapters)}`;
}

/** Her saved work on one chapter. */
export type ChapterWork = { chapter: string; owned: string[]; mine: string[]; notes: string | null; completedAt: string | null };

/** Chapters that count toward her progress: written chapters (not the introduction or coming ones). */
export function countedChapters(chapters: BookChapter[] = visibleChapters([])) {
  return chapters.filter((c) => c.kind === "chapter" && c.status === "ready");
}

export function bookProgress(work: ChapterWork[], chapters: BookChapter[] = visibleChapters([])) {
  const counted = countedChapters(chapters);
  const done = counted.filter((c) => work.some((w) => w.chapter === c.slug && w.completedAt)).length;
  const next = counted.find((c) => !work.some((w) => w.chapter === c.slug && w.completedAt)) ?? null;
  return { done, total: counted.length, next };
}

/** Cleans up the habits she adds: trimmed, no blanks or duplicates, within limits. */
export function cleanMyHabits(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const text = raw.replace(/\s+/g, " ").trim().slice(0, MY_HABIT_LENGTH);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out.slice(0, MY_HABITS_MAX);
}

export function cleanBookTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, BOOK_TITLE_MAX);
}
