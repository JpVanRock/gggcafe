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

/**
 * A step of a chapter's course (the Mental Toughness chapter): step-through lessons
 * with quick checks (instant feedback, nothing graded) and things to try. Steps are
 * grouped by `lesson`; her place is saved by step number, so append steps at the end
 * of a lesson only when it's the last lesson (or accept that saved places shift).
 */
export type CourseStep = {
  lesson: string;
  title: string;
  body: string[];
  check?: { question: string; choices: string[]; answer: number; why: string };
  /** something to try in practice or in her Mental GP */
  tryIt?: string;
};

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
  /** step-through lessons before the foundation; she finishes them to complete the chapter */
  course?: CourseStep[];
  /** her own tools shown on the chapter page: "count-plan" = her count plan from My Zone (Pop Report) */
  tools?: "count-plan"[];
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
    status: "ready",
    title: "Hitting Approach",
    question: "Do I step in with a plan, or just hope for a good pitch?",
    summary: "Your plan at the plate: a routine from the dugout to the box, a count plan, two strikes, the short game and a slump reset.",
    why: [
      "The best hitters aren't guessing. They know what they're looking for, where they want it and what changes with two strikes. From 43 feet you don't have time to decide in the box, so decide before you get there.",
      "Your plan starts in the dugout: what this pitcher throws, what she's thrown you, what the situation needs. By the time you dig in, the at-bat is about executing a decision you've already made.",
    ],
    tools: ["count-plan"],
    habits: [
      { key: "ha-dugout", text: "I scout from the dugout.", detail: "Her pitches, what she throws ahead and behind, where the catcher sets up." },
      { key: "ha-on-deck", text: "I time her on deck.", detail: "Swings on time with her release, not just warm-up swings." },
      { key: "ha-one-job", text: "I step in with one job.", detail: "The count, the situation and the pitch I'm hunting." },
      { key: "ha-my-pitch", text: "I hunt my pitch early.", detail: "Ahead in the count, I let everything else go." },
      { key: "ha-two-strikes", text: "With two strikes I battle.", detail: "Shorter swing, wider zone, fight off tough pitches." },
      { key: "ha-situation", text: "I know the situation before every pitch.", detail: "Outs, runners, the sign, and what moves a runner." },
      { key: "ha-leave-it", text: "One at-bat doesn't follow me.", detail: "Learn from it, then leave it at the plate." },
    ],
    course: [
      {
        lesson: "The Routine",
        title: "It starts in the dugout",
        body: [
          "Your at-bat starts long before you're on deck. Watch the pitcher from the dugout: what she throws, which pitch she trusts when she's behind, what she goes to with two strikes, where the catcher sets up.",
          "Talk with your teammates after their at-bats. What did she start them with? What did she get them out with? That's free scouting.",
        ],
        check: {
          question: "When should you start learning about this pitcher?",
          choices: ["On deck", "In the box, on the first pitch", "From the dugout, every inning", "After your first at-bat"],
          answer: 2,
          why: "The dugout is your best seat for scouting. Every pitch she throws to your teammates is information for your at-bat.",
        },
      },
      {
        lesson: "The Routine",
        title: "In the hole and on deck",
        body: [
          "In the hole: gear on, check the situation (outs, runners, score) and think about what your team might need from you.",
          "On deck: time her. Swing with her release, not just to loosen up. Watch where the catcher sets up and how the defense plays the hitter in front of you.",
        ],
      },
      {
        lesson: "The Routine",
        title: "In the box",
        body: [
          "Before you step in: a breath, a look at your coach for the sign, and your one job for this pitch. Then dig in and see the ball out of her hand.",
          "Same routine every at-bat, first inning or last. A routine is how you stay on time when the game speeds up.",
        ],
        tryIt: "Write your box routine in three steps in your notes below, then use it in every practice at-bat this week.",
      },
      {
        lesson: "Your Count Plan",
        title: "Hitter's counts and pitcher's counts",
        body: [
          "Ahead in the count (1-0, 2-0, 2-1, 3-1) the pitcher has to throw a strike. That's when you hunt your pitch and let everything else go.",
          "Behind (0-1, 0-2, 1-2) she can throw her best pitch off the plate. Your job changes: handle what you can and stay alive.",
        ],
        check: {
          question: "Which count is the best time to sit on one pitch in one zone?",
          choices: ["0-2", "2-0", "1-2", "0-1"],
          answer: 1,
          why: "At 2-0 she has to come to you. Hunt your pitch; if it isn't there, 3-0 is still your count.",
        },
      },
      {
        lesson: "Your Count Plan",
        title: "Hunt early, protect late",
        body: [
          "0 strikes: your pitch only. 1 strike: anything you handle. 2 strikes: protect the whole zone and battle on your weak spots.",
          "Your count plan below comes from My Zone in your Pop Report. Mark your pitch, what you handle and your weak spots there, and the plan updates itself.",
        ],
      },
      {
        lesson: "Two Strikes",
        title: "The two-strike approach",
        body: [
          "With two strikes, a close pitch can be called strike three. Widen your zone a little, shorten your swing (choke up if it helps) and let the ball travel deeper.",
          "Your goal is contact. A foul ball is a win: it keeps you alive and makes her throw another pitch. Fight off her best pitches until she misses.",
        ],
        check: {
          question: "You're 1-2 against a pitcher with a great drop ball. What's the best adjustment?",
          choices: [
            "Swing harder so you don't miss it",
            "Look only for a pitch down the middle",
            "Take until she walks you",
            "Shorten up, look a little higher and fight off the drop",
          ],
          answer: 3,
          why: "A drop ball ends in the dirt. Look slightly higher, keep a short swing and foul off the tough ones until she leaves one up.",
        },
      },
      {
        lesson: "The Short Game",
        title: "Bunts that work",
        body: [
          "Sacrifice: square early, bunt a strike, get it down on the ground away from the pitcher. Push bunt: firmer, past the charging pitcher or first baseman. Drag bunt: a surprise for a hit, down the line.",
          "Squeeze: on the suicide the runner is coming, so get the bat on the ball no matter where the pitch is. On the safety, she goes only when the bunt is down.",
        ],
      },
      {
        lesson: "The Short Game",
        title: "Slappers read the corners",
        body: [
          "A slapper reads the defense. Corners playing back: soft slap or drag bunt. Corners charging: hard slap past them. Shortstop crashing early: hit it behind her.",
          "Even if you don't slap, know what each one beats. It helps you on defense, and it helps you read what your slappers are doing.",
        ],
        check: {
          question: "You're slapping and the third baseman and shortstop both charge as she starts her motion. What's the play?",
          choices: ["Soft slap toward third", "Hard slap on the ground past them", "Drag bunt", "Take the pitch"],
          answer: 1,
          why: "When the left side crashes, the space is behind them. A hard slap on the ground beats charging infielders.",
        },
      },
      {
        lesson: "Reading the Pitcher",
        title: "Patterns and tells",
        body: [
          "Pitchers repeat what works. Track what she starts you with, what she throws when she's behind and what she uses to put you away.",
          "Watch for tells: a glove that flares on the change-up, a different arm speed, a catcher who always sets up early. Share what you see with your coach and teammates.",
        ],
      },
      {
        lesson: "Slump Reset",
        title: "Get out of your own way",
        body: [
          "Every hitter slumps. The fix usually isn't a new swing. Shrink the goal: hit the ball hard, that's it. Hard outs count as good at-bats.",
          "Go back to the basics: tee and front toss, one cue word, and your routine. Watch video of your good at-bats. Results come back when the process does.",
        ],
        tryIt: "Pick one cue word and a hard-contact goal for your next game, and write them in your notes below.",
      },
    ],
  },
  {
    slug: "mental-toughness",
    kind: "chapter",
    status: "ready",
    title: "Mental Toughness",
    question: "When the game gets hard, do I get tighter or tougher?",
    summary: "Tough isn't a mood. It's a set of skills you train like a swing: confidence, focus, breathing and a reset you trust.",
    why: [
      "Every player looks tough when she's 3-for-3. Mental toughness is what you do in the other moments: after the error, down two in the seventh, behind 0-2 to the best pitcher you've seen all year.",
      "You aren't born with it. It's a set of skills: how you talk to yourself, where you put your focus, how you use your breath and how fast you get back to the next pitch. You can train every one of them. Work through the course, then own the habits.",
    ],
    habits: [
      { key: "mt-why", text: "I know why I play.", detail: "And I remind myself before big games and after bad days." },
      { key: "mt-next-pitch", text: "One pitch at a time.", detail: "The last pitch is over. The next one is the only one I can win." },
      { key: "mt-controllables", text: "I control my effort, attitude and preparation.", detail: "Not the umpire, the weather, the score or the lineup card." },
      { key: "mt-reset", text: "I have a reset and I use it.", detail: "Release, breathe, refocus. I'm ready before the next pitch." },
      { key: "mt-self-talk", text: "I talk to myself like a teammate.", detail: "Short, specific and on my side." },
      { key: "mt-breath", text: "I breathe before big moments.", detail: "A long breath out slows my heart rate and my thoughts." },
      { key: "mt-see-it", text: "I see it before I do it.", detail: "I picture the pitch, the swing or the play before it happens." },
    ],
    course: [
      {
        lesson: "Confidence",
        title: "Confidence is built, not felt",
        body: [
          "Confidence isn't a feeling that shows up when things go well. It's trust, and you build it the same way you build a swing: rep by rep.",
          "Every bucket of tee work, every bullpen and every extra ground ball is a deposit. When the big moment comes, you're not hoping. You're drawing on work you've already done.",
        ],
        check: {
          question: "You've gone 0-for-8 this weekend. Where does real confidence come from right now?",
          choices: [
            "Getting a hit in your next at-bat",
            "The work you've already put in and your plan for this at-bat",
            "Your coach telling you you're a good hitter",
            "Waiting until you feel it again",
          ],
          answer: 1,
          why: "Results come and go. Your preparation and your plan are always yours, and they're what you can trust when the results aren't there yet.",
        },
      },
      {
        lesson: "Confidence",
        title: "Carry yourself like the player you're becoming",
        body: [
          "Your body talks before you do. Head up, shoulders back, a confident walk to the box. The other dugout reads it, your teammates read it, and so does your own brain.",
          "You don't have to feel confident to carry yourself with confidence. Do it first. The feeling usually follows.",
        ],
        tryIt: "At your next practice, keep the same walk and posture after a miss as after your best rep.",
      },
      {
        lesson: "Your Why",
        title: "Know why you play",
        body: [
          "Hard days ask a question: why am I doing this? Have your answer ready before they ask.",
          "Maybe it's your teammates, the feeling of a perfect throw, the player you want to become or the people in the stands. Your why doesn't have to sound impressive. It has to be true.",
        ],
        tryIt: "Write your why in one sentence in your Mental GP notes. Read it before your next tournament.",
      },
      {
        lesson: "One Pitch at a Time",
        title: "The only pitch you can win",
        body: [
          "Softball comes in short bursts: a pitch, a play, then a break. The break is where games are won or lost, because it's where your mind wanders.",
          "The last pitch is gone, good or bad. The next inning hasn't happened. The only pitch you can win is the next one, so that's where your focus goes.",
        ],
        check: {
          question: "You struck out looking with runners on in the 5th. Now you're in the field. What's your job on the first pitch?",
          choices: [
            "Replay the at-bat so you don't repeat it",
            "Think about your next at-bat",
            "Get to your spot, take your prep step and want the ball",
            "Stay quiet so nobody notices you're upset",
          ],
          answer: 2,
          why: "The at-bat is over. Right now your team needs a fielder who's ready on this pitch. Learn from the at-bat later, in the dugout or in your journal.",
        },
      },
      {
        lesson: "One Pitch at a Time",
        title: "Next pitch, whatever the score",
        body: [
          "Up ten or down two, the next pitch gets the same attention. Teams that win close games play the seventh inning the same way they played the first.",
          "When your mind jumps ahead (if we win this, we play at noon) or behind (I can't believe I missed that), bring it back with your cue word and the next pitch.",
        ],
      },
      {
        lesson: "Control the Controllables",
        title: "Know what's yours",
        body: [
          "You control three things: your effort, your attitude and your preparation. Not the strike zone, the field, the weather, the lineup or what people say in the stands.",
          "Energy spent on what you can't control is energy you don't have for the next pitch. Tough players notice the umpire's zone, adjust and move on.",
        ],
        check: {
          question: "The umpire calls a pitch you know was outside, and now you're down 0-2. What's the tough response?",
          choices: [
            "Step out, breathe, widen your zone a little and battle",
            "Tell the umpire it was outside",
            "Shake your head so your coach knows it was a bad call",
            "Swing at the next pitch no matter where it is",
          ],
          answer: 0,
          why: "You can't change the call. You can control your adjustment: a breath and your two-strike approach.",
        },
      },
      {
        lesson: "Breathing",
        title: "Your breath is a remote control",
        body: [
          "When the game speeds up, your heart rate climbs, your grip tightens and your thoughts race. Your breath is the fastest way to turn that down.",
          "Breathe in through your nose, then let a longer breath out. That long exhale tells your body to settle, and it takes about five seconds: the time you have between pitches.",
        ],
        tryIt: "Try it now: in for four counts, out for six. Do three. Then practice it as a guided session in your Mental GP.",
      },
      {
        lesson: "Breathing",
        title: "Make it part of every pitch",
        body: [
          "Use a breath before every pitch in the circle, before you step into the box, and in the field before the pitcher starts her motion.",
          "Build it into your routine so it's automatic. Then it's there in the big moments without you having to remember it.",
        ],
        check: {
          question: "Which breath helps you settle down the most?",
          choices: ["Quick, short breaths", "Holding your breath", "A big breath in through your mouth", "A breath out that's longer than the breath in"],
          answer: 3,
          why: "A long exhale slows your heart rate. Short or held breaths keep you tight.",
        },
      },
      {
        lesson: "Find Your Zone",
        title: "Not too hot, not too cold",
        body: [
          "Every player has a level of intensity where she plays her best. Too low and you're flat: slow feet, late swings. Too high and you're tight: rushing, overthrowing, chasing pitches.",
          "Your zone is personal. Some players play best at a calm 6, some at a fired-up 8. Rate yourself 1 to 10 before games in your Mental GP and you'll see where your best games come from.",
        ],
        check: {
          question: "You feel flat before warm-ups, about a 3. Your zone is 6 to 8. What helps?",
          choices: [
            "Sit in the dugout and save your energy",
            "Quick feet, a sharp cue word and a hard first throw",
            "Think about everything that could go wrong",
            "Long, slow breathing",
          ],
          answer: 1,
          why: "Under your zone, move: quick feet, energy in your voice, a sharp cue word. Slow breathing is for coming down from too high.",
        },
      },
      {
        lesson: "Green, Yellow, Red",
        title: "Know your signals",
        body: [
          "Green: you're locked in. Loose hands, clear head, seeing the ball.",
          "Yellow: the first warning signs. Rushing, gripping tight, thinking about the score or who's watching.",
          "Red: it's gotten away from you. Racing thoughts, short breath, head down, can't let the last play go.",
          "The skill is catching yellow early. A quick release at yellow keeps you from ever getting to red.",
        ],
        tryIt: "Fill in your own green, yellow and red signs in your Mental GP, with a release for yellow and red.",
      },
      {
        lesson: "Green, Yellow, Red",
        title: "Release, then refocus",
        body: [
          "A release is something physical that ends the last play: fix your batting gloves, wipe the dirt off your hands, tap your glove twice, look at a spot on the fence.",
          "Then a breath, then your cue word and the next pitch. Use the same release every time, in practice too. The more you rep it, the faster it works in a game.",
        ],
      },
      {
        lesson: "See It First",
        title: "Your brain practices too",
        body: [
          "When you picture a play in detail, your brain works a lot like it does when you actually make it. That's why great players see the pitch, the swing or the play before it happens.",
          "Make it real: what you see, what you hear (the ping of the bat, your teammates), what you feel (the grip, your feet in the dirt). See it at game speed and see it go right.",
        ],
        tryIt: "Before your next game, take one minute: see yourself in the box, see the pitch you want, see your best swing. Or open a guided session in your Mental GP.",
      },
      {
        lesson: "Mistakes Are Information",
        title: "Failure is part of the game",
        body: [
          "Softball is built on failure. Great hitters make an out most times they step in. Pitchers give up hits. Everybody makes errors.",
          "Tough players treat a mistake as information: what happened, and what will I do next time? Then they let it go and ask one question: what's the next right thing?",
        ],
        check: {
          question: "You make an error that lets a run score. What's the best response?",
          choices: [
            "Apologize to everyone at the end of the inning",
            "Hope the next ball goes somewhere else",
            "Use your release, breathe and want the next ball hit to you",
            "Play it safe for the rest of the game",
          ],
          answer: 2,
          why: "Wanting the next ball is what tough players do. Your release and a breath get you there. Learn from the play later.",
        },
      },
      {
        lesson: "Mistakes Are Information",
        title: "Talk to yourself like a teammate",
        body: [
          "You'd never tell a teammate she's terrible and always does this. Don't say it to yourself either.",
          "Swap the put-down for something short and useful: next pitch, stay through it, glove down and see it in. Good self-talk sounds like a good coach: honest, specific and on your side.",
        ],
      },
      {
        lesson: "Your Reset",
        title: "Build a reset you trust",
        body: [
          "Put it together into one routine:",
          "1. Release: one physical action that ends the last play.",
          "2. Breathe: in through your nose, a long breath out.",
          "3. Refocus: your cue word and the next pitch.",
          "Write it in your Mental GP under Reset after a mistake, rep it in every practice, and then own the habits below.",
        ],
      },
    ],
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
export type ChapterWork = {
  chapter: string;
  owned: string[];
  mine: string[];
  notes: string | null;
  completedAt: string | null;
  /** chapters with a course: the furthest step she reached, and when she finished it */
  courseStep?: number;
  courseDoneAt?: string | null;
};

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

/** The course's lessons in order, with the index of each lesson's first step. */
export function courseLessons(steps: CourseStep[]): { name: string; start: number; count: number }[] {
  const out: { name: string; start: number; count: number }[] = [];
  steps.forEach((step, i) => {
    const last = out[out.length - 1];
    if (last && last.name === step.lesson) last.count += 1;
    else out.push({ name: step.lesson, start: i, count: 1 });
  });
  return out;
}
