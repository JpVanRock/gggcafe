// Coach training: The Mental Game (user, 2026-11-12). A course for coaches, separate
// from the players' Mental GP lessons (src/lib/mental-lessons.ts): how to coach the
// mental side of fastpitch, what to say, how to build it into practice, and where a
// coach's job ends. Each module has why it matters, what to do, "say this / not
// this", one thing to try this week, and a note the coach keeps. Players never see it.
// Original wording. No imports, so unit tests and client components can use it.
// Slugs are stored in coach_mental_lessons.lesson: never rename one; add at the end.

export type CoachModule = {
  slug: string;
  title: string;
  minutes: number;
  /** one line for the list */
  summary: string;
  why: string[];
  steps: { title: string; text: string }[];
  /** what to say, and what to stop saying */
  sayThis?: { say: string; notThis: string }[];
  /** one thing to try at practice this week */
  thisWeek: string;
  /** the question the coach answers in their notes */
  reflect: { prompt: string; hint: string };
  takeaway: string;
  /** the players' Mental GP lessons this module goes with (slugs) */
  pairsWith: string[];
};

export const COACH_NOTES_MAX = 2000;

export const COACH_MODULES: CoachModule[] = [
  {
    slug: "your-words",
    title: "Your Words Become Her Self-Talk",
    minutes: 7,
    summary: "Players repeat what coaches say, out loud and in their heads. Make it worth repeating.",
    why: [
      "Ask a player what she tells herself after a strikeout and you'll often hear her coach's voice. What you say at practice becomes the voice in her head in the seventh inning.",
      "Instruction that names what you're afraid of (\"Don't pop up\") puts the picture of the pop-up in her head. Instruction that names the action (\"Stay on top of it\") gives her something to do.",
      "Teenage athletes hear criticism louder than praise. That doesn't mean coaching soft. It means correction that's specific, about the action, and followed by belief.",
    ],
    steps: [
      { title: "Coach the action, not the result", text: "Talk about what she can do on the next rep: hands, eyes, feet, timing. The result is what happens after." },
      { title: "Make praise specific", text: "\"Great job\" fades. \"You stayed through that outside pitch and drove it the other way\" teaches and builds trust at the same time." },
      { title: "Correct, then believe", text: "Fix it in one sentence, then tell her you expect her to get it: \"Glove out front. You've got that one.\"" },
      { title: "Give the team a shared language", text: "Pick a few cue words as a staff, for hitting, the circle and defense, and use them every day. In a loud game, two words carry farther than a paragraph." },
      { title: "Count your words", text: "Over one practice, how many of your comments were corrections and how many were specific praise? Most coaches are surprised by the answer." },
    ],
    sayThis: [
      { say: "Stay on top of it.", notThis: "Don't pop it up." },
      { say: "Hit the mitt, low.", notThis: "Don't walk her." },
      { say: "Glove down, see it in.", notThis: "Stop booting everything." },
      { say: "What did you see on that pitch?", notThis: "What were you thinking?" },
    ],
    thisWeek: "Ask an assistant or a parent volunteer to tally your comments at one practice: corrections in one column, specific praise in the other. Then pick three cue words for the team and use them all week.",
    reflect: {
      prompt: "What do you say most often after a player makes a mistake? Write the version you want to say instead.",
      hint: "Think about your tone and your face too, not just the words.",
    },
    takeaway: "Say what you want to see. She'll hear it again when it counts.",
    pairsWith: ["between-pitches"],
  },
  {
    slug: "after-mistakes",
    title: "The Five Seconds After a Mistake",
    minutes: 6,
    summary: "How you react to an error decides whether she plays the next pitch free or tight.",
    why: [
      "After an error a player looks two places: at the ground and at the dugout. What she sees on your face in the next five seconds tells her whether it's safe to keep competing.",
      "Players who are afraid of the coach's reaction play not to fail. They tighten up, hope the ball isn't hit to them and stop taking aggressive swings. That costs more runs than the error did.",
    ],
    steps: [
      { title: "Neutral face, then the signal", text: "Agree as a staff on what you do after any mistake: a clap and \"next one,\" or a reset signal the team knows. The same every time." },
      { title: "Save the fix for later", text: "Mid-inning is for the next pitch. Teach between innings, in a calm voice, and only one fix." },
      { title: "Coach the reset", text: "Teach every player a flush move and a \"want it\" phrase (it's a lesson on her Mental GP), then praise the reset itself: \"Great flush. That's how we play.\"" },
      { title: "Separate effort from execution", text: "A missed ground ball is part of the game. Not backing up a throw is a choice. Coach them differently." },
      { title: "Don't use the bench to punish one mistake", text: "Pulling a player right after one error teaches the whole team to play scared. If you make a change, explain it later, in private, as part of the plan." },
    ],
    sayThis: [
      { say: "Next one. We want it hit to you.", notThis: "You have to make that play." },
      { say: "Your feet stopped. Keep them moving through the ball.", notThis: "What was that?" },
      { say: "Great flush. That's how we play.", notThis: "Finally." },
    ],
    thisWeek: "In your next scrimmage, watch your own reaction to errors. Afterward, ask one assistant: \"What did my face say after mistakes today?\"",
    reflect: {
      prompt: "What will your team's reset signal be, and how will you teach it this week?",
      hint: "A word and a move everyone knows, from the dugout to the outfield.",
    },
    takeaway: "Your reaction is part of the next pitch. Make it a reset, not a replay.",
    pairsWith: ["after-the-error"],
  },
  {
    slug: "teach-routines",
    title: "Put the Mental Game Into Practice",
    minutes: 7,
    summary: "Routines, breathing and self-talk only show up in games if you rep them at practice.",
    why: [
      "Most teams talk about the mental game and then never practice it. A player can't use a skill in the sixth inning of a bracket game that she's only heard about once.",
      "Mental skills are trained like any other skill: taught simply, repped often and tested under pressure.",
    ],
    steps: [
      { title: "Teach it in five minutes", text: "One skill a week: the between-pitch routine, the flush, the breath, cue words. Explain it, show it, have everyone try it." },
      { title: "Build it into drills", text: "In BP every hitter runs her routine before every pitch. In defensive drills every fielder takes her prep step and calls her what-if. Pitchers run the full routine in every bullpen." },
      { title: "Reward the routine", text: "Catch players doing it: \"Nice reset before that pitch.\" What you praise is what they keep." },
      { title: "Use their Mental GP", text: "Players log intensity checks, their signals and a monthly self-scan, and work through the Mental GP lessons. Look at them and ask about them. If you look, they'll keep doing it." },
      { title: "Close practice with a look-back", text: "Two minutes at the end: one thing that went well, one thing to fix. Point them to their practice journal." },
    ],
    thisWeek: "Pick one mental skill for this week. Teach it in five minutes at the start of practice, build it into one drill, and call out three players you see using it.",
    reflect: {
      prompt: "Which mental skill will you teach first, and in which drill will you rep it?",
      hint: "Start with the one your team needs most right now.",
    },
    takeaway: "If it isn't repped at practice, it won't show up on game day.",
    pairsWith: ["between-pitches", "nerves"],
  },
  {
    slug: "practice-pressure",
    title: "Build Pressure Into Practice",
    minutes: 7,
    summary: "Design drills that feel like the seventh inning, so the seventh inning feels like practice.",
    why: [
      "Players get comfortable in comfortable practices. Then games feel different: faster, louder, more riding on every pitch. The gap between practice and games is where players tighten up.",
      "Pressure you design on purpose closes that gap. Small doses, often, with a short debrief, so players learn their reset works when it counts.",
    ],
    steps: [
      { title: "Put a score on it", text: "Ten clean ground balls in a row, a team goal in bunt defense, strikes out of fifteen pitches in a bullpen. Keep a record players can try to beat." },
      { title: "Start in the count", text: "Live at-bats that start 0-2 or 3-2, runners on second and third, one out. Make the situations real." },
      { title: "Add stakes, not punishment", text: "The losing group picks up the equipment, the winning group picks the next drill. Keep it light: running for errors teaches fear, not toughness." },
      { title: "Add noise and speed", text: "Dugout chatter, a clock between pitches, quick moves from one station to the next. Games aren't quiet, so practice shouldn't always be either." },
      { title: "Debrief it", text: "After a pressure drill, ask: \"What did you notice in your body? What did you do about it?\" That's where they learn their reset." },
      { title: "Build up to it", text: "Start small. Players new to pressure need reps they can win before reps that are hard to win." },
    ],
    sayThis: [
      { say: "Count's 0-2, runners on second and third. Battle.", notThis: "Just hit." },
      { say: "What did you notice when it got tight?", notThis: "You choked." },
    ],
    thisWeek: "Turn one drill at your next practice into a pressure drill: give it a score and a game situation, and finish with a two-question debrief.",
    reflect: {
      prompt: "Which drill will you turn into a pressure drill, and how will you score it?",
      hint: "Pick a drill your team already knows well.",
    },
    takeaway: "Practice the pressure on purpose, so it's nothing new when it counts.",
    pairsWith: ["pressure-at-bats"],
  },
  {
    slug: "read-your-players",
    title: "Read the Player in Front of You",
    minutes: 7,
    summary: "Some players need calm, some need a spark. Learn to tell, and use what they've told you.",
    why: [
      "The same message lands differently on different players. A fired-up speech that helps one hitter pushes another one into the red.",
      "Players tell you what they need, in their body language and on their Mental GP: their green, yellow and red signals, their zone and their self-scan. Coaches who use it coach the player, not the average player.",
    ],
    steps: [
      { title: "Learn their signals", text: "Read each player's green, yellow and red signs and her releases on her Mental GP page. Know what yellow looks like for each of your starters." },
      { title: "Know their zone", text: "One player's best games come at a 5, her teammate's at an 8. Check intensity before games: a calm word for the player over her zone, energy for the one under it." },
      { title: "Watch for the tells", text: "Rushing, a death grip on the bat, eyes on the stands, quiet in the dugout, no eye contact. Catch it at yellow, before it's red." },
      { title: "Ask, don't assume", text: "\"When it gets tight, what helps you more: a quick word or some space?\" Write down the answer." },
      { title: "Watch the trend", text: "A self-scan that drops two months in a row, or a player who stops logging anything, can mean more than a slump. Check in." },
    ],
    sayThis: [
      { say: "Long breath. Pick your spot.", notThis: "Calm down!" },
      { say: "Quick feet. Want it!", notThis: "Wake up!" },
    ],
    thisWeek: "Before your next game, read the signals of your starting lineup on their Mental GP pages and write one line per player: what she needs from you when she's in yellow.",
    reflect: {
      prompt: "Pick two players who need different things from you. What does each one need?",
      hint: "Think about your words, your volume and when to give her space.",
    },
    takeaway: "Coach the player in front of you, not the average player.",
    pairsWith: ["nerves"],
  },
  {
    slug: "conversations",
    title: "Conversations That Build Confidence",
    minutes: 8,
    summary: "The slump talk, the playing-time talk and the after-game talk: when to have them and how.",
    why: [
      "The conversations players remember happen one-on-one: after a bad weekend, when the lineup changes, when they're struggling. Done well, they build trust for years. Done badly, they're what a player remembers about the whole season.",
      "When and where you talk matters as much as what you say.",
    ],
    steps: [
      { title: "Pick the moment", text: "Not right after a loss, not in front of teammates. A calm moment at practice, in view of another adult." },
      { title: "Ask first", text: "\"How do you think it's going?\" \"What are you seeing?\" Let her talk before you do. You'll find out what she already knows." },
      { title: "Be clear about roles", text: "Players handle a clear answer better than a vague one. Say what her role is now, why, and exactly what would change it." },
      { title: "Give her one thing", text: "Not a list. One thing to work on, and a plan to work on it together." },
      { title: "End with belief", text: "Tell her what you see in her, specifically. It's the part she'll replay on the drive home." },
      { title: "Wait a day for the breakdown", text: "Right after a game, keep it short: what went well, one thing to work on, when we practice next. Save the details for practice, when everyone is calmer." },
    ],
    sayThis: [
      { say: "Your role right now is defense and pinch running. Here's what moves you into the lineup.", notThis: "Just keep working hard." },
      { say: "What are you seeing in your at-bats?", notThis: "You need to stop overthinking." },
      { say: "I believe in your swing. We're fixing the timing, not rebuilding it.", notThis: "I don't know what's going on with you." },
    ],
    thisWeek: "Have one planned one-on-one this week with a player who's struggling or whose role changed. Ask first, give her one thing, end with belief.",
    reflect: {
      prompt: "Which player needs a conversation from you this week, and what's the one thing you'll give her?",
      hint: "Write the first question you'll ask her.",
    },
    takeaway: "Ask first, be clear, give one thing, end with belief.",
    pairsWith: ["slumps", "your-role"],
  },
  {
    slug: "your-temperature",
    title: "You Set the Dugout's Temperature",
    minutes: 6,
    summary: "Your body language, your voice and how you handle umpires: the team copies all of it.",
    why: [
      "Players watch the coach to find out how worried they should be. Arms crossed and pacing after a bad inning says panic. Calm and ready says we're fine, next pitch.",
      "Coaches feel pressure too. The ones who handle it well have a routine for it, the same thing they ask of their players.",
    ],
    steps: [
      { title: "Have your own reset", text: "A breath before you give the next sign, a look at your lineup card, a word with your assistant." },
      { title: "Watch your posture", text: "No pacing, no hands on your head, no throwing your clipboard. The dugout reads your face before it hears your voice." },
      { title: "Handle umpires the way you want players to", text: "Ask calmly, at the right time, then move on. If you argue every call, your players will too, and lose focus doing it." },
      { title: "Keep your voice for teaching", text: "Loud and calm beats loud and angry. Save your biggest energy for effort and hustle, not for mistakes." },
      { title: "Shrink the big moments", text: "Before a big inning, say it plainly: \"This is what we practice for. Run your routine.\"" },
    ],
    sayThis: [
      { say: "This is what we practice for. Run your routine.", notThis: "We have to score here or we're done." },
      { say: "Blue, can you tell me what you saw on that one?", notThis: "That's ridiculous, Blue!" },
    ],
    thisWeek: "Ask an assistant to watch your body language for one game: after errors, after bad calls and in a close last inning. Talk about it afterward.",
    reflect: {
      prompt: "What's your own reset when the game gets tight?",
      hint: "Something you can do in the coach's box or the dugout in a few seconds.",
    },
    takeaway: "The team plays at the temperature you set.",
    pairsWith: ["what-you-cant-control"],
  },
  {
    slug: "team-reset",
    title: "A Team That Resets Together",
    minutes: 7,
    summary: "Habits that keep the whole dugout on the next pitch: a team reset, dugout jobs and an after-game routine.",
    why: [
      "Individual mental skills are good. A team that resets together is better: when one player starts to slide, three teammates pull her back before a coach has to.",
      "Teams build that with shared habits. Keep them simple, make sure everyone knows them, and have your leaders model them.",
    ],
    steps: [
      { title: "Pick a team reset", text: "A call and a move the whole field does after a big hit or an error: the catcher calls it, gloves up, everyone answers. Practice it until it's automatic." },
      { title: "Give everyone a dugout job", text: "Charting pitches, tracking signs, reminding the defense of the outs, leading the energy. Nobody's just watching." },
      { title: "Let your captains lead it", text: "Teach your leaders to start the reset, to get to a teammate after a mistake and to keep the dugout loud and positive when it's tight." },
      { title: "Celebrate the process", text: "The walk that started the rally, the backup that saved a base, the great flush after an error. Your team will chase what you celebrate." },
      { title: "Close every game the same way", text: "Win or lose: a short huddle, one thing that went well, one thing to work on, when we're back. Then it's over." },
      { title: "Bring parents in", text: "Share your reset language with parents (the welcome packet in Dugout → Parents) and ask them to use it. A calm ride home helps a player more than a full breakdown." },
    ],
    thisWeek: "Pick your team's reset with your captains and practice it in one drill. Add it to your team's culture page or welcome packet.",
    reflect: {
      prompt: "What's your team's reset, and who will lead it on the field?",
      hint: "The call, the move, and the player who starts it.",
    },
    takeaway: "When the team resets together, nobody has to do it alone.",
    pairsWith: ["after-the-error", "game-day"],
  },
  {
    slug: "know-the-line",
    title: "Know the Line: Wellbeing and When to Get Help",
    minutes: 6,
    summary: "You coach the mental game. You aren't a counselor. Know the signs and what to do.",
    why: [
      "Mental performance skills (routines, breathing, self-talk) help with nerves and slumps. They aren't treatment for anxiety, depression, disordered eating or anything else a player may be dealing with, and coaches shouldn't try to make them that.",
      "You see your players more than almost any adult outside their family. That makes you one of the people most likely to notice when something is wrong.",
    ],
    steps: [
      { title: "Know the signs", text: "Changes that last more than a couple of weeks: pulling away from teammates, losing interest in things she loved, big changes in energy, sleep, eating or weight, injuries or illnesses that keep coming back, talk of being worthless or a burden." },
      { title: "Say what you see, with care", text: "In private and in view of another adult: \"I've noticed you seem down lately. How are you doing?\" Then listen. You don't need to fix it." },
      { title: "Bring in the right people", text: "Talk with her parents or guardians and encourage help from a doctor, a school counselor or a licensed mental health professional. Follow your organization's safeguarding rules." },
      { title: "Act right away if she may be in danger", text: "If a player talks about hurting herself or not wanting to be alive, don't leave her alone and get help now: call or text 988 (the Suicide & Crisis Lifeline in the U.S.), or 911 in an emergency, and tell her parents." },
      { title: "Don't promise secrecy", text: "You can promise to listen and to help. You can't promise to keep something to yourself when her safety is at risk." },
      { title: "Protect the basics", text: "Rest, sleep, food and time away from softball matter. A player who is always tired, always hurt or never takes a break needs a conversation, not more reps." },
    ],
    sayThis: [
      { say: "I've noticed you seem down lately. How are you doing?", notThis: "Toughen up." },
      { say: "I'm glad you told me. Let's get you some help, together.", notThis: "This stays between us." },
    ],
    thisWeek: "Find out your organization's policy for a player in crisis and who you call. Save 988 in your phone and write your local resources in your notes below.",
    reflect: {
      prompt: "Who would you call first if a player told you she was struggling? Write the names and numbers.",
      hint: "Her parents, your organization's contact, a school counselor, local resources, 988.",
    },
    takeaway: "Notice, ask, listen, and bring in the right help. You don't have to fix it alone.",
    pairsWith: [],
  },
];

export function moduleBySlug(slug: string): CoachModule | undefined {
  return COACH_MODULES.find((m) => m.slug === slug);
}

/** Its number in the course, 1-based (0 if it isn't one). */
export function moduleNumber(slug: string): number {
  return COACH_MODULES.findIndex((m) => m.slug === slug) + 1;
}

/** The module before and after, for the arrows at the bottom of a module. */
export function moduleNeighbors(slug: string): { prev: CoachModule | null; next: CoachModule | null } {
  const i = COACH_MODULES.findIndex((m) => m.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: COACH_MODULES[i - 1] ?? null, next: COACH_MODULES[i + 1] ?? null };
}

/** How many of the course's modules are finished (ignores slugs that aren't modules). */
export function modulesDone(done: Iterable<string>): number {
  const slugs = new Set(COACH_MODULES.map((m) => m.slug));
  return new Set([...done].filter((s) => slugs.has(s))).size;
}
