// Mental GP lessons (Standard, user 2026-11-12): eight short lessons that put the
// mental game to work in real game moments. Each one has the idea, the steps to build
// her own version, what it looks like at each position, a rep for practice, a
// question she answers, and the Mental GP tools that go with it.
// They apply the skills rather than re-teach them: the G3 Advanced chapters (the
// "deeper" slugs, linked for players who have G3) carry the full teaching. Four
// answers save straight into her Mental Game Plan (`planField`), so the lessons build
// her plan instead of a second copy of it. `skills` are the self-scan skills a lesson
// builds, for the suggested next lesson. Original wording, written for fastpitch.
// The coaches' course is separate (src/lib/coach-training.ts).
// No imports, so unit tests and client components can use it. Slugs are stored in
// player_mental_lessons.lesson: never rename one; add new lessons at the end.

/** A Mental GP tool a lesson points to: a section of her Mental GP page, the journal, or a guided session. */
export type LessonTool = "signals" | "intensity" | "scan" | "journal" | `session:${string}`;

/** Mental Game Plan fields a lesson's answer can save to (columns of mental_game_plans). */
export type LessonPlanField = "pre_game_routine" | "pre_pitch_routine" | "reset_routine" | "pressure_plan";

export type MentalLesson = {
  slug: string;
  title: string;
  minutes: number;
  /** one line for the list */
  summary: string;
  /** the idea, in a few short paragraphs */
  idea: string[];
  /** how to build it, step by step */
  steps: { title: string; text: string }[];
  /** what it looks like in a game, by position or by situation */
  situations?: { heading: string; items: { who: string; text: string }[] };
  /** a rep for her next practice */
  rep: string;
  /** the question she answers to finish the lesson */
  reflect: { prompt: string; hint: string };
  /** her answer saves to this Mental Game Plan field (and shows there) */
  planField?: LessonPlanField;
  /** the one line to remember */
  lockIn: string;
  tools: LessonTool[];
  /** the self-scan skills it builds (SCAN_SKILLS keys in src/lib/mental.ts) */
  skills: string[];
  /** G3 Advanced chapters that go deeper (slugs in advanced-book.ts), linked only for players with G3 */
  deeper: string[];
};

export const LESSON_ANSWER_MAX = 1500;

export const MENTAL_LESSONS: MentalLesson[] = [
  {
    slug: "between-pitches",
    title: "Your Routine, Your Position",
    minutes: 6,
    summary: "Build the routine you run between pitches, made for where you play.",
    idea: [
      "The seconds between pitches are where focus leaks out: replaying the last pitch, guessing at the next one, checking the stands. A routine plugs the leak by giving those seconds a job.",
      "A hitter's routine won't work for a catcher, and a pitcher's won't work in left field. This lesson builds yours: where it happens, what starts it, what you check and how long it takes.",
    ],
    steps: [
      { title: "Find your spot", text: "Where your routine happens: with your back foot out of the box, at the back of the circle, in your crouch, or in the few steps around your position." },
      { title: "Pick your start", text: "One small move that starts it every time, good pitch or bad: re-strap a batting glove, smooth the dirt with your cleat, step back onto the pitcher's plate." },
      { title: "Know what you check", text: "Hitter: the sign and the count. Pitcher: the sign and the mitt. Catcher: runners, count and the call. Fielder: outs, runners and where the ball goes if it's hit to you." },
      { title: "Fit it in the time you have", text: "You get a few seconds, not a minute. Time yours at practice and trim it until it fits, every pitch." },
      { title: "End on one word", text: "The last step is a cue word that says go: \"see it,\" \"attack,\" \"low.\" Then eyes on your target." },
    ],
    situations: {
      heading: "By position",
      items: [
        { who: "Hitter", text: "Front foot stays in the box, back foot out: gloves, sign, word, back in. It fits in the few seconds the rules give you." },
        { who: "Pitcher", text: "Ball in the glove, a breath, onto the plate, the sign, the mitt. After a hard-hit ball, the same routine at the same speed." },
        { who: "Catcher", text: "Throw it back, check your runners, give the sign with the same rhythm every pitch. Your pace sets the defense's." },
        { who: "Fielder", text: "One what-if: \"Two outs, runner on first, sure out at first.\" Then your prep step with the pitcher's release." },
      ],
    },
    rep: "At practice, time your routine during BP or a bullpen. Run it on every rep, the bad ones too, until it takes the same few seconds every time.",
    reflect: {
      prompt: "Write your pre-pitch routine for your position, step by step.",
      hint: "Where it happens, the move that starts it, what you check, your last word.",
    },
    planField: "pre_pitch_routine",
    lockIn: "Same routine every pitch. The moment can get big; your routine doesn't.",
    tools: ["session:reset-breath", "signals"],
    skills: ["focus", "composure"],
    deeper: ["every-pitch", "mental-toughness"],
  },
  {
    slug: "pressure-at-bats",
    title: "Big Moments: Shrink the Job",
    minutes: 6,
    summary: "Bases loaded, last inning, the game on the line: how to keep a big moment the size of one pitch.",
    idea: [
      "Pressure makes everything look bigger. The pitcher looks faster, the zone looks smaller, and your mind jumps to the score, the dugout and who's watching.",
      "You can't make a big moment small. You can make your job small: not \"win the game,\" but one thing you can do on this pitch.",
    ],
    steps: [
      { title: "Notice it getting big", text: "Your signs show up first: a faster heartbeat, a tight grip, thinking about the result. Noticing them is your cue to shrink the job." },
      { title: "Name your job", text: "Say it in a few words: \"Hard ground ball, middle.\" \"Ball in the air to the outfield.\" \"Low strike.\" \"First step, then the ball.\" Never \"be the hero.\"" },
      { title: "One breath, one word", text: "A long breath out, then your cue word. That's the whole plan for the next few seconds." },
      { title: "Commit before, accept after", text: "Decide before the pitch and go all in. Whatever happens, you'll flush it. Players who fear the result hold back; players who accept it ahead of time let it go." },
    ],
    situations: {
      heading: "In the game",
      items: [
        { who: "Hitter", text: "Runner on third, less than two outs: your job is a ball in the air to the outfield or a hard ground ball. That's all." },
        { who: "Pitcher", text: "Not \"don't walk her\" but \"low and away, hit the mitt.\" Name the pitch and the spot." },
        { who: "Fielder", text: "Want it hit to you. Know where the throw goes before the pitch, so there's nothing left to decide." },
        { who: "Base runner", text: "Know the outs and your read before the pitch. With two outs, you're running on contact." },
      ],
    },
    rep: "At practice, play \"game on the line\": one at-bat each with a runner on third and one out. Before you step in, say your job out loud to a teammate.",
    reflect: {
      prompt: "Write your big-moment plan: the sign you'll notice, how you'll name your job, and your breath and word.",
      hint: "Example: \"Heart racing, grip tight. My job: a hard ground ball up the middle. Long breath out, 'drive.'\"",
    },
    planField: "pressure_plan",
    lockIn: "Make the job small enough to do on this pitch.",
    tools: ["session:confident-at-bat", "intensity"],
    skills: ["composure", "confidence"],
    deeper: ["on-deck", "hitting-approach"],
  },
  {
    slug: "nerves",
    title: "Nerves Mean You're Ready",
    minutes: 5,
    summary: "Butterflies aren't a warning sign. Learn to read them and use them.",
    idea: [
      "A pounding heart, butterflies, sweaty hands: that's your body getting ready to compete. It feels almost exactly like being excited. What changes is the story you tell yourself about it.",
      "Telling yourself to calm down rarely works when your heart is racing. Telling yourself \"I'm ready, this is my body getting going\" works better, because it's true.",
      "Nerves mean you care about the game. That's not something to get rid of. It's something to use.",
    ],
    steps: [
      { title: "Notice it", text: "Name what you feel without judging it: \"Heart's going, hands are cold.\" Naming it takes some of the power out of it." },
      { title: "Rename it", text: "Swap \"I'm nervous\" for \"I'm ready\" or \"I'm fired up.\" Say it like you mean it." },
      { title: "Check your number", text: "Rate yourself 1 to 10 against your zone. In it, use it. Over it, a long breath out, loose jaw, slow walk. Under it, move your feet and turn your voice up." },
      { title: "Give the energy a job", text: "Point it at something: your first throw, your first ground ball, the first pitch you see. Energy with a target is fuel." },
    ],
    rep: "Before your next scrimmage or game, run the check-in: notice it, rename it, rate yourself, and log it as an intensity check. After the game, compare how you played with your number.",
    reflect: {
      prompt: "What do nerves feel like in your body, and what will you tell yourself when they show up?",
      hint: "Example: \"My legs feel shaky and I want to rush. I'll tell myself: I'm ready, this is my body getting going.\"",
    },
    lockIn: "Nerves are fuel. Point them at the next pitch.",
    tools: ["intensity", "session:box-breathing", "signals"],
    skills: ["confidence", "breathing"],
    deeper: ["pre-game", "mental-toughness"],
  },
  {
    slug: "after-the-error",
    title: "Build Your Flush",
    minutes: 5,
    summary: "A flush made for your position and for the mistakes that stick with you most.",
    idea: [
      "Most players know they're supposed to let mistakes go. Fewer have a flush that actually works for them: at their position, for the mistakes that bother them most, fast enough to be ready for the next pitch.",
      "This lesson builds yours: one move, one phrase, done before the next pitch, and practiced until it happens without thinking.",
    ],
    steps: [
      { title: "Name your sticky mistake", text: "The one that stays with you longest: a strikeout looking, an error that scores a run, a walk, a passed ball. Plan for that one first." },
      { title: "Pick one move", text: "Something physical you do only after a mistake, that works where you play: redo a batting glove, smooth the dirt with your cleat, take the long way around the circle, reset your mask." },
      { title: "Pick one phrase", text: "Short and pointed forward: \"Next one.\" \"Hit it to me.\" \"Glove down.\"" },
      { title: "Beat the next pitch", text: "Move, phrase, ready position, all before the pitcher is set. Still stuck when she's set? One more breath, then get there." },
      { title: "Fix it at the right time", text: "Not on the field. Between innings with your coach, or in your journal that night." },
    ],
    situations: {
      heading: "By position",
      items: [
        { who: "Infielder after an error", text: "Smooth the dirt, your phrase, then call the outs to your teammates. Talking pulls you back into the play." },
        { who: "Outfielder after a misplay", text: "Jog back, tap your glove, your phrase, and adjust a step deeper or shallower if the play told you something." },
        { who: "Catcher after a passed ball", text: "Reset your mask, find your pitcher and give her a nod. She takes her cue from you." },
        { who: "Pitcher after a walk or a home run", text: "Off the back of the circle, your move, your phrase, back on. New hitter, new pitch." },
        { who: "Hitter after a strikeout", text: "Redo your gloves on the walk back and tell the next hitter what you saw." },
      ],
    },
    rep: "At practice, every missed ground ball and every swing-and-miss in BP gets your flush before the next rep. Ask a teammate to call you out if you skip it.",
    reflect: {
      prompt: "Write your flush: your sticky mistake, your move and your phrase.",
      hint: "Example: \"Errors that score a run. Smooth the dirt with my cleat, 'hit it to me,' call the outs.\"",
    },
    planField: "reset_routine",
    lockIn: "One move, one phrase, ready before the next pitch.",
    tools: ["signals", "session:red-light-breath", "journal"],
    skills: ["reset", "self_talk"],
    deeper: ["response-to-failure", "mental-toughness"],
  },
  {
    slug: "slumps",
    title: "Climbing Out of a Slump",
    minutes: 6,
    summary: "Bad weekends happen. How to stop pressing, measure what you control and keep helping your team.",
    idea: [
      "Every player hits a stretch where nothing falls. The slump isn't the real problem. Pressing is: trying harder and harder to force a result until you're tight, rushed and thinking about everything except the next pitch.",
      "Getting out is mostly mental. Measure what you control, build your confidence on evidence instead of results, and keep finding ways to help your team while the results come back.",
    ],
    steps: [
      { title: "Spot the press", text: "Swinging at everything, a new stance every at-bat, dreading your turn, replaying at-bats in bed. Two of these and you're pressing." },
      { title: "Set goals you control", text: "For your next game: swing at strikes, run your full routine every pitch, see the first pitch well. Pitchers: first-pitch strikes, one pitch to one spot. Check those off, not your average." },
      { title: "Keep an evidence list", text: "Write down every good rep: a ball on the screws, a great at-bat that ended in an out, a clean inning. On a bad weekend, read it. Proof beats a feeling." },
      { title: "Ask your coach one question", text: "\"What are you seeing?\" Then work on that one thing. Five fixes you invent in the dugout make it worse." },
      { title: "Win somewhere else", text: "A slump at the plate doesn't have to follow you to your position. Make the play, run the bases hard, bring energy to the dugout. Your team still needs all of it." },
    ],
    situations: {
      heading: "Not just hitters",
      items: [
        { who: "Pitcher", text: "A week of walks or a pitch that won't break is a slump too. Same plan: goals you control, an evidence list, one question for your coach." },
        { who: "Fielder", text: "Missed a few in a row? Slow it down at practice: clean, easy reps first, then build back up to game speed." },
      ],
    },
    rep: "Before your next game, write two goals you control in your journal. Afterward, check them off and add one thing to your evidence list.",
    reflect: {
      prompt: "Write your slump plan: the signs you're pressing, two goals you control, and where else you'll help your team.",
      hint: "Example: \"I chase high pitches when I press. Goals: swing at strikes, full routine every pitch. Elsewhere: loud in the dugout, sharp on defense.\"",
    },
    lockIn: "Stop pressing, own the process, help your team somewhere else.",
    tools: ["journal", "scan"],
    skills: ["perspective", "confidence", "effort"],
    deeper: ["hitting-approach", "mental-toughness"],
  },
  {
    slug: "what-you-cant-control",
    title: "Calls, Bounces and Noise",
    minutes: 5,
    summary: "Umpires, weather, the stands and your phone: how to handle what you didn't pick.",
    idea: [
      "Every game hands you things you didn't choose: an umpire with a tight zone, a field with bad hops, wind blowing in, a loud voice behind the backstop, a group chat after the game.",
      "You don't have to like any of it. You do get to decide where your attention goes. Arguing with a call never changes it; it only pulls your eyes off the next pitch.",
    ],
    steps: [
      { title: "Notice it", text: "\"The zone is tight today.\" \"The infield is fast.\" That's information, not an insult." },
      { title: "Share it", text: "Tell your teammates what you learned: the zone, the wind, how the ball comes off the dirt. A whole dugout adjusts faster than one player." },
      { title: "Adjust to it", text: "Wind blowing in: line drives beat fly balls. Wet field: a sure grip before the throw. Bright sun: glasses down and call for help early on a pop-up. Fast infield: play a step back." },
      { title: "Keep your face neutral", text: "After a bad call or a bad hop, your face and your shoulders are the only part of it you control. Keep them the same." },
      { title: "Turn down the noise", text: "In the stands: pick a focal point, like a sign on the fence or your third-base coach, and go there when it gets loud. On your phone: no stats, comments or replays until you've written in your journal and slept on it." },
    ],
    situations: {
      heading: "After the game",
      items: [
        { who: "The ride home", text: "It's okay to say, \"Can we talk about it tomorrow?\" Most players need a night before they're ready to break a game down." },
        { who: "Social media", text: "Post the team picture, not the argument. Anything you'd regret your coach reading, don't send." },
      ],
    },
    rep: "At your next scrimmage, ask your coach to throw in a few \"bad calls\" and a change in conditions, like a wet ball or a new field. Practice notice, share, adjust, then laugh about it.",
    reflect: {
      prompt: "What outside thing gets in your head the most, and what's your plan for it?",
      hint: "Example: \"Loud parents behind the backstop. I'll use the third-base coach as my focal point and run my routine.\"",
    },
    lockIn: "Notice it, share it, adjust to it, play the next pitch.",
    tools: ["signals", "session:reset-breath"],
    skills: ["perspective", "composure", "communication"],
    deeper: ["mental-toughness", "response-to-failure"],
  },
  {
    slug: "your-role",
    title: "Ready When Your Name Is Called",
    minutes: 6,
    summary: "Playing time, your role and the bench: how to stay ready and earn more.",
    idea: [
      "Not everyone starts every game, and nobody likes sitting. What you do with that time tells your coaches more than any tryout.",
      "Every team needs a full roster: the pinch runner, the defensive sub, the hitter who comes off the bench in the sixth. The player who's ready when her name is called earns the next chance.",
    ],
    steps: [
      { title: "Know your role", text: "Ask your coach at a calm time, not right after a game: \"What's my role right now, and what do I need to do to earn more time?\" Write down the answer." },
      { title: "Stay in the game", text: "From the dugout, chart the pitcher, watch the catcher's setup and call out what you see. You'll come in knowing more than the player you replace." },
      { title: "Stay warm", text: "A few throws between innings, a stretch in the fifth. Be ready on the first pitch you play." },
      { title: "Compete without comparing", text: "A teammate's good game isn't bad news for you. Cheer for her for real, then outwork her at practice. That's how good teams get better." },
      { title: "Own the work", text: "Practice effort, extra reps, being coachable, energy in the dugout. Coaches notice, and it's all yours to control." },
    ],
    rep: "This week, take a dugout job during a scrimmage or game: chart pitches, track the other team's signs, or remind the defense of the outs. Tell your coach afterward what you saw.",
    reflect: {
      prompt: "What's your role on the team right now, and what are you working on to earn more?",
      hint: "If you're not sure of your role, write the question you'll ask your coach.",
    },
    lockIn: "Be ready on the first pitch, whether it's the first inning or the sixth.",
    tools: ["journal", "session:game-face"],
    skills: ["effort", "communication"],
    deeper: ["every-pitch", "communication"],
  },
  {
    slug: "game-day",
    title: "Your Game-Day Routine",
    minutes: 7,
    summary: "From the night before to the drive home: a routine that gets you ready, and a plan for when the day goes sideways.",
    idea: [
      "Great players don't wait to feel ready. They have a routine that gets them there, the same steps before every game, so the big ones feel like any other.",
      "A routine also gives you something to fall back on when the day goes sideways: a rain delay, an early game, a long wait between games at a tournament.",
    ],
    steps: [
      { title: "The night before", text: "Bag packed (extra socks, sunscreen, water bottle), a real dinner, real sleep. Phone down earlier than usual." },
      { title: "The morning", text: "A breakfast you've eaten before, water, and five minutes on your own: your cue word, why you play, one guided session." },
      { title: "After warm-ups", text: "Check in: rate your intensity and turn it up or down before the first pitch." },
      { title: "Between innings", text: "Water, one thing you noticed, back to your routine. Leave the last inning in the last inning." },
      { title: "Between games", text: "Shade, food, water, then switch off for a while. Close out the last game before you warm up for the next one." },
      { title: "After", text: "Three things that went well and one thing to work on, in your journal. Then it's over." },
    ],
    situations: {
      heading: "If-then plans",
      items: [
        { who: "If I strike out my first at-bat", text: "then I flush it, tell the next hitter what I saw, and plan my next at-bat." },
        { who: "If the game is delayed", text: "then I stay loose, eat something small and redo my warm-up when we're called back." },
        { who: "If I'm not in the lineup", text: "then I take a dugout job and stay warm, so I'm ready when my name is called." },
      ],
    },
    rep: "Write your routine on a card or in your phone notes and run all of it before your next scrimmage or game. Change whatever doesn't work.",
    reflect: {
      prompt: "Write your game-day routine and two if-then plans.",
      hint: "From the night before to the first pitch. If ___ happens, then I'll ___.",
    },
    planField: "pre_game_routine",
    lockIn: "Ready is a routine, not a feeling.",
    tools: ["intensity", "session:game-face", "session:lock-in-inning", "journal"],
    skills: ["preparation", "focus"],
    deeper: ["pre-game", "between-innings"],
  },
];

export function lessonBySlug(slug: string): MentalLesson | undefined {
  return MENTAL_LESSONS.find((l) => l.slug === slug);
}

/** Its number in the course, 1-based (0 if it isn't one). */
export function lessonNumber(slug: string): number {
  return MENTAL_LESSONS.findIndex((l) => l.slug === slug) + 1;
}

/** The lesson before and after, for the arrows at the bottom of a lesson. */
export function lessonNeighbors(slug: string): { prev: MentalLesson | null; next: MentalLesson | null } {
  const i = MENTAL_LESSONS.findIndex((l) => l.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: MENTAL_LESSONS[i - 1] ?? null, next: MENTAL_LESSONS[i + 1] ?? null };
}

/** How many of the course's lessons are finished (ignores slugs that aren't lessons). */
export function lessonsDone(done: Iterable<string>): number {
  const slugs = new Set(MENTAL_LESSONS.map((l) => l.slug));
  return new Set([...done].filter((s) => slugs.has(s))).size;
}

/**
 * The lesson to do next: the first unfinished one that builds her weakest self-scan
 * skill (`weakSkills`, weakest first), else the first unfinished one in order. Null
 * once she has finished them all. `skill` says which weak skill picked it.
 */
export function nextLesson(done: Iterable<string>, weakSkills: string[] = []): { lesson: MentalLesson; skill: string | null } | null {
  const finished = new Set(done);
  const open = MENTAL_LESSONS.filter((l) => !finished.has(l.slug));
  if (open.length === 0) return null;
  for (const skill of weakSkills) {
    const lesson = open.find((l) => l.skills.includes(skill));
    if (lesson) return { lesson, skill };
  }
  return { lesson: open[0], skill: null };
}

/** Two digits for the outlined numerals: 1 -> "01". */
export const twoDigits = (n: number) => String(n).padStart(2, "0");
