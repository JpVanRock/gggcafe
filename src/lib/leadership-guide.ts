// G3 Leadership Guide: part of G3 Advanced, for the players a coach chooses to
// train as leaders. The coach picks the Full Leadership Program (twenty-five core
// lessons, a personal leadership plan, Extra Reps) or Leadership Light (eight short
// lessons and a short plan, for players 11 and under), written for GGG.Cafe in the voice of a
// veteran athlete talking to her teammate: bold, honest about fear and failure,
// all about owning your choices and lifting the team. Simple, direct, no quotes.
//
// Paid content: import this file from SERVER code only, never from a "use client"
// file. Her work is keyed by lesson slug and by the keys below, so lessons can be
// added or reordered without losing anything. No imports, so it runs in unit tests.

export const GUIDE_TITLE = "G3 Leadership Guide";

/** The welcome on the guide's first page. */
export const GUIDE_INTRO = [
  "Your coach picked you for this. Not because you're perfect, and not because you're the loudest. Because they see a leader in you.",
  "Here's the truth from one competitor to another: leading is hard. You'll have to say things people don't want to hear, stand alone sometimes, and own it when you mess up. You'll also find out you're capable of a lot more than you think.",
  "Twenty-five short lessons, one rung at a time. Read it, answer honestly, do the work. Then write your plan, get your coach's sign-off, and earn your certificate.",
];
export const BONUS_TITLE = "Extra Reps";
export const BONUS_INTRO =
  "Short lessons on leading, team culture, character and mental toughness. Optional. Take them in any order, as many times as you want.";
export const ANSWER_MAX = 1500;

/** The seven rungs every lesson hangs on. Rungs 1-4: leading yourself. 5-7: leading others. */
export const LADDER = [
  "Choose your mindset",
  "Own the responsibility",
  "Lead with your words",
  "Lead with your actions",
  "Lead through relationships",
  "Lead through accountability",
  "Lead by inspiring",
] as const;

export const CORE_PARTS = ["Why it matters", "Lead yourself", "Lead others", "Lead the team", "Learn from the greats", "Keep climbing"] as const;
export const BONUS_SHELVES = ["Lead", "Team and culture", "Character", "Mental toughness", "Know your why"] as const;
export const LIGHT_PARTS = ["Lead yourself", "Lead your team"] as const;
export type CorePart = (typeof CORE_PARTS)[number];
export type BonusShelf = (typeof BONUS_SHELVES)[number];
export type LightPart = (typeof LIGHT_PARTS)[number];

/**
 * The two programs a coach can pick (user, 2026-11-10): the Full Leadership Program (the
 * 25-lesson guide, Extra Reps, the rubric) or Leadership Light, eight short lessons for
 * players 11 and under. Both are part of G3 Advanced and both earn the Leader Badge.
 */
export type Program = "full" | "light";
export const PROGRAMS: readonly Program[] = ["full", "light"];
export const isProgram = (v: unknown): v is Program => v === "full" || v === "light";
export const PROGRAM_NAME: Record<Program, string> = { full: "Full Leadership Program", light: "Leadership Light" };
/** What the player sees at the top of her pages. */
export const LIGHT_TITLE = "G3 Leadership Light";
export const programTitle = (p: Program) => (p === "light" ? LIGHT_TITLE : GUIDE_TITLE);

export type HabitItem = { key: string; group: string; text: string };
export type Scenario = { key: string; group: string; title: string; situation: string; move: string };
export type RubricArea = { key: string; group?: string; title: string; looks: string };
export type LeaderRole = { key: string; title: string; does: string; brings: string };

export type LessonTool = "habits" | "rubric" | "scenarios" | "starters" | "roles" | "engagement";

export type Lesson = {
  slug: string;
  /** core: the Full program's course; bonus: its Extra Reps; light: Leadership Light */
  kind: "core" | "bonus" | "light";
  /** the core part, the bonus shelf or the Leadership Light part it sits in */
  part: CorePart | BonusShelf | LightPart;
  title: string;
  /** the one thing to remember */
  bigIdea: string;
  /** a few short paragraphs */
  body: string[];
  /** short lists that go with the lesson (myths, mistakes, keys...) */
  lists?: { title: string; points: string[] }[];
  /** an interactive piece on the page */
  tool?: LessonTool;
  /** "your turn": she writes an answer to each */
  questions: { key: string; text: string }[];
  /** "try this": she checks each off */
  steps: { key: string; text: string }[];
};

type LessonText = Omit<Lesson, "kind">;
const core = (lessons: LessonText[]): Lesson[] => lessons.map((l) => ({ ...l, kind: "core" }));
const bonus = (lessons: LessonText[]): Lesson[] => lessons.map((l) => ({ ...l, kind: "bonus" }));
const light = (lessons: LessonText[]): Lesson[] => lessons.map((l) => ({ ...l, kind: "light" }));

// ---------------------------------------------------------------------------
// The core lessons (the course: all of them, plus a committed plan and the
// coach's sign-off, earn the certificate)
// ---------------------------------------------------------------------------

export const LESSONS: Lesson[] = core([
  {
    slug: "why-leadership",
    part: "Why it matters",
    title: "Why Leadership?",
    bigIdea: "Your team's real culture is whatever its players allow when the coach isn't around.",
    body: [
      "Every team has three groups: the coaches, the leaders, and everyone else. Coaches set the standard. But coaches aren't in the dugout chatter, the hotel hallway, the group chat or the bus ride home. You are.",
      "What happens in those places is the real culture of your team, and leaders decide it. Raise the bar or let it slide. Include everyone or let cliques form. Speak up or stay quiet. That choice comes up every single season, and the best teams have players who make it the right way.",
      "The best teams don't wait for leaders to show up. They build them. That's what this guide is for.",
    ],
    questions: [
      { key: "q1", text: "What does leadership mean to you, in your own words?" },
      { key: "q2", text: "Think about the best team you've been on. What did its leaders do that made the difference?" },
      { key: "q3", text: "When the coach isn't around, what does your team allow right now? What should change?" },
    ],
    steps: [
      { key: "s1", text: "Hold yourself to the team's standard this week, especially when no coach is watching." },
      { key: "s2", text: "Notice one moment where the culture slipped. Write down what a leader could have done." },
    ],
  },
  {
    slug: "what-is-leadership",
    part: "Why it matters",
    title: "What Is Leadership?",
    bigIdea: "Leadership is influence. You already have it, so the question is how you use it.",
    body: [
      "Leadership isn't a title, a captain's patch or a speech. It's influence: how what you do and say changes the people around you. Every player on the roster has some. The quiet one who outworks everybody has it. So does the one who rolls her eyes at the coach.",
      "Leaders know where the team is going and show the way by doing it first. They read the moment and adjust. And they listen: to coaches, to teammates, to feedback that stings. Being a good follower is part of being a leader.",
      "Never underestimate the first person who joins you. One leader doing the right thing is a moment. Two is the start of a movement.",
    ],
    lists: [
      {
        title: "You're leading when you",
        points: [
          "Put the team ahead of your own stats.",
          "Give something up for the team without being asked.",
          "Leave nothing on the field.",
          "Turn a mistake into a lesson instead of an excuse.",
          "Do the little things right when nobody's watching.",
          "Give more than you're asked and expect less back.",
          "Say \"I can,\" then follow through.",
          "Make the hustle play: the dive, the backup, the sprint on and off the field.",
          "Play through the bumps and bruises without the drama.",
          "Cheer from the bench as hard as you play on the field.",
          "Shut down trash talk about your own team.",
          "Expect your teammates' best, and show them yours.",
          "Leave the dugout cleaner than you found it.",
          "Help the program without asking what's in it for you.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Who do you influence: on this team, at school, at home?" },
      { key: "q2", text: "Who's a leader who changed you? What exactly did she or he do?" },
      { key: "q3", text: "Which line on the list do you already live? Which one is missing?" },
    ],
    steps: [
      { key: "s1", text: "Be the first to do the right thing at practice this week: first to sprint, first to pick up gear, first to help." },
      { key: "s2", text: "Back up a teammate who does something right. Be her first follower." },
    ],
  },
  {
    slug: "leadership-myths",
    part: "Why it matters",
    title: "Leadership Myths",
    bigIdea: "If you think you're not a leader because you're young, quiet or not the best player, you've been sold a myth.",
    body: [
      "A lot of players never lead because they believe something about leadership that just isn't true. Let's clear it out.",
      "Leaders are made, not born. They're built rep by rep, the same way you built your swing.",
    ],
    lists: [
      {
        title: "Myth, then the truth",
        points: [
          "Only seniors lead. Truth: any grade can, freshmen included.",
          "Only captains lead. Truth: every great team has many leaders.",
          "Leaders know the most. Truth: leaders keep learning and use everyone's strengths.",
          "Leading comes naturally. Truth: it takes work, like any skill.",
          "Leaders are outgoing. Truth: quiet players lead all the time.",
          "A title makes you a leader. Truth: influence does. A title is just a title.",
          "Leaders are born. Truth: leaders are built, rep by rep.",
          "The best player is the leader. Truth: work ethic and attitude matter more than talent.",
          "Leaders are loud. Truth: a quiet example, a connection or a cheer all count.",
          "Leaders are perfect. Truth: owning your mistakes is what builds trust.",
          "Leaders hold others accountable first. Truth: they hold themselves accountable first.",
          "Managing and leading are the same. Truth: organizing is managing; getting people to believe in where you're going is leading. A team needs both.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Which myth have you believed? How did it hold you back?" },
      { key: "q2", text: "Have you seen someone use a title instead of earning respect? What happened to the team?" },
      { key: "q3", text: "What kind of leader could you be, just as you are right now?" },
    ],
    steps: [
      { key: "s1", text: "Pick the myth that held you back and do one thing this week that proves it wrong." },
      { key: "s2", text: "Tell a younger teammate she can lead too, and show her how." },
    ],
  },
  {
    slug: "every-player-leads",
    part: "Why it matters",
    title: "Every Player Leads",
    bigIdea: "Leadership is never one or two people's job. Winning teams have leaders who step up in different ways.",
    body: [
      "If every player did her job and held herself accountable, a team would barely need leaders. That almost never happens, so winning teams lean on many leaders, not just the captains.",
      "Look at your dugout and you'll see seven kinds of leaders. Celebrate all of them, find the one you are, and fill in who plays each role on your team.",
    ],
    tool: "roles",
    questions: [
      { key: "q1", text: "Which kind of leader are you? Which one could you grow into?" },
      { key: "q2", text: "Which role is missing on your team right now? What happens because of it?" },
      { key: "q3", text: "How does having many leaders take pressure off any one player?" },
    ],
    steps: [
      { key: "s1", text: "Tell a teammate which kind of leader you see in her, and why." },
      { key: "s2", text: "Lead in your own way once this week, in a moment the captains don't." },
    ],
  },
  {
    slug: "the-ladder",
    part: "Why it matters",
    title: "The Leadership Ladder",
    bigIdea: "Leadership starts inside you and works its way out: choose it, lead yourself, then lead others.",
    body: [
      "Leadership is a climb, and it never really ends. You'll keep climbing for the rest of your life: on this team, in school, in whatever you do next.",
      "The first rungs are about you: deciding to lead and owning what comes with it. The middle rungs are leading yourself with your words and your actions. Only then do you lead others, through relationships, accountability and finally the top rung: inspiring people to be more than they thought they could be.",
      "Skip the bottom rungs and the ladder falls. Nobody follows a leader who doesn't lead herself.",
    ],
    lists: [{ title: "The seven rungs", points: [...LADDER] }],
    questions: [
      { key: "q1", text: "Which rung are you standing on right now? Be honest." },
      { key: "q2", text: "Why do you think choosing to lead comes before everything else?" },
      { key: "q3", text: "Have you seen someone with natural talent who chose not to lead? What did it cost the team?" },
    ],
    steps: [
      { key: "s1", text: "Write down the rung you want to reach by the end of this season." },
      { key: "s2", text: "Do one thing this week that leads yourself: your effort, your words or your choices." },
    ],
  },
  {
    slug: "choose-to-lead",
    part: "Lead yourself",
    title: "Choose to Lead",
    bigIdea: "Leadership is a decision. Make it, and own everything that comes with it.",
    body: [
      "Rung one is your mindset. Leaders believe they can get better at anything with work, and they treat failure as information, not a verdict. A negative leader is a contradiction. Nobody follows that energy for long.",
      "Rung two is responsibility, and it's where most people stop. Leading means hard calls, holding teammates to the standard, and sometimes standing alone when it isn't popular. If that scares you a little, good. It means you get it.",
      "Here's what you get back: respect, real connection with your team, growth you can't get any other way, and the feeling of doing the right thing when it counted.",
    ],
    questions: [
      { key: "q1", text: "Why do you want to lead? Say it plainly." },
      { key: "q2", text: "Tell about a time you stood alone for what was right. How did it feel? What did you learn?" },
      { key: "q3", text: "What part of the responsibility scares you most, and what will you do about it?" },
    ],
    steps: [
      { key: "s1", text: "Make the choice: tell your coach you want to lead this season." },
      { key: "s2", text: "Find one place on the team where you can step up this week, and do it." },
    ],
  },
  {
    slug: "all-in",
    part: "Lead yourself",
    title: "All In",
    bigIdea: "Commitment means showing up all the way: body, mind and heart, especially when it's hard.",
    body: [
      "Commitment is staying locked on your goals in school, in softball and in life, and showing up for them even after a setback. Being at practice isn't the same as being present at practice. Your teammates can tell the difference.",
      "Every team has players at five levels of engagement. The middle is crowded and comfortable. Getting to the top takes a climb, and the bottom keeps sinking if you let it. The teams that win have the most players near the top.",
      "Your commitment sets the example for everyone watching, and it carries into everything you do after softball.",
    ],
    lists: [
      {
        title: "The five levels",
        points: [
          "Level 5, All in: lives for the team's goals, owns everything, starts things without being asked.",
          "Level 4, Locked in: always involved, owns her job, works with everyone.",
          "Level 3, Along for the ride: does her part but needs a nudge to speak up or bring ideas.",
          "Level 2, Checked out: little energy, rarely starts anything, goes through the motions.",
          "Level 1, Gone: no interest, doesn't contribute, doesn't respond.",
        ],
      },
    ],
    tool: "engagement",
    questions: [
      { key: "q1", text: "What does being present, not just there, look like at practice?" },
      { key: "q2", text: "What pulls you down a level? Be specific." },
      { key: "q3", text: "What will move you, and your team, up one level?" },
    ],
    steps: [
      { key: "s1", text: "Bring level-5 energy to one full practice this week." },
      { key: "s2", text: "Notice a teammate stuck at level 2 or 3 and pull her in." },
    ],
  },
  {
    slug: "words-and-actions",
    part: "Lead yourself",
    title: "Lead with Words and Actions",
    bigIdea: "Your teammates believe what you do far more than what you say. Make them match.",
    body: [
      "Your words build people up or tear them down. Leaders keep it positive, keep it clear, and keep it honest, because honesty is where trust comes from.",
      "Your actions are louder. Be one of the hardest workers on the field, every day. Make team-first choices in school, in softball and in your social life, because your teammates see all three. And when it goes wrong, bounce back with grit and poise. How you handle the bad days is what people remember.",
    ],
    lists: [
      {
        title: "Lead yourself",
        points: [
          "Words: positive, clear, honest.",
          "Work ethic: among the hardest workers, every day.",
          "Choices: team-first in school, in softball and in your social life.",
          "Resilience: grit and poise when it goes wrong.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Do your words and your actions match right now? Where don't they?" },
      { key: "q2", text: "How do you use your words to build teammates up?" },
      { key: "q3", text: "Be honest about your work ethic. Would your teammates call you one of the hardest workers?" },
    ],
    steps: [
      { key: "s1", text: "Rate yourself on words, work ethic, choices and resilience. Pick the weakest one to work on." },
      { key: "s2", text: "Go a full week without one negative word about a teammate, a coach or yourself." },
    ],
  },
  {
    slug: "relationships",
    part: "Lead others",
    title: "Lead Through Relationships",
    bigIdea: "People follow people they trust. Relationships come before everything else you'll ask of them.",
    body: [
      "Leading others starts with connection. Leading out loud means talking to your teammates, all of them, not just your friends. Aim for at least five positive moments for every critical one.",
      "Connect: include everyone, every role, every grade. Celebrate: cheer the bench player's good at-bat as loud as the home run. Bring energy-giving plays: the hustle back to the dugout, the high five, the fist bump after a great inning.",
      "Relationships are the foundation. Without them, holding someone accountable feels like an attack. With them, it feels like someone who believes in you.",
    ],
    questions: [
      { key: "q1", text: "Who on your team do you barely talk to? Why?" },
      { key: "q2", text: "What energy-giving plays happen in softball? Which ones do you bring?" },
      { key: "q3", text: "How does celebrating every role change a team's culture?" },
    ],
    steps: [
      { key: "s1", text: "Have a real conversation with a teammate you don't usually talk to." },
      { key: "s2", text: "Celebrate a teammate's small win out loud, in front of the team." },
      { key: "s3", text: "Bring three energy-giving plays to every practice this week." },
    ],
  },
  {
    slug: "accountability-inspiration",
    part: "Lead others",
    title: "Accountability and Inspiration",
    bigIdea: "You're the gatekeeper of your team's standard. Hold the line, and then lift people higher than they thought they could go.",
    body: [
      "Accountability is the hardest rung, because it means going against what everyone else is doing. Somebody slacks on a drill, cuts a sprint short or makes a bad choice. You either let it slide, and the standard drops for everyone, or you step up. That's what a gatekeeper does.",
      "It's easier when the relationship is already there. If your teammates know you have their back, they'll hear you when you hold them to the standard.",
      "The top rung is inspiration: bringing out the best in people and pushing them to give more than they thought they had. You can't skip to it. You earn it by climbing every rung below.",
    ],
    questions: [
      { key: "q1", text: "Why is holding a teammate accountable so hard? What makes it harder on your team?" },
      { key: "q2", text: "What happens to a team when sub-standard behavior is allowed?" },
      { key: "q3", text: "Who's inspired you most? What did she or he actually do?" },
    ],
    steps: [
      { key: "s1", text: "With your coach, write down your team's standards: behavior, commitment, effort." },
      { key: "s2", text: "The next time the standard slips in front of you, say something, kindly and clearly." },
    ],
  },
  {
    slug: "culture",
    part: "Lead the team",
    title: "Culture: What We Allow",
    bigIdea: "Culture is what you allow, what you emphasize, and what you do every single day.",
    body: [
      "Culture isn't a poster on the wall. It's built one decision at a time: what you let slide, what you make a big deal of, and what you do every day when nobody's grading it.",
      "Leaders are the gatekeepers. The coach can't be in the hotel lobby at a tournament, the back of the bus or the group chat, so what you allow there is your culture. That's why player-led teams win. Check in with your coach often so you're building the same thing.",
    ],
    lists: [{ title: "Culture is", points: ["What you allow.", "What you emphasize.", "What you do every day."] }],
    questions: [
      { key: "q1", text: "What does your team emphasize right now? What does it allow that it shouldn't?" },
      { key: "q2", text: "Tell about a time you were a gatekeeper, or a time you should have been." },
      { key: "q3", text: "How can you and your coach stay on the same page about culture?" },
    ],
    steps: [
      { key: "s1", text: "Write down what your team allows now versus the culture you want." },
      { key: "s2", text: "Pick one thing to emphasize every day this week and lead it." },
    ],
  },
  {
    slug: "communication",
    part: "Lead the team",
    title: "Talk Like a Leader",
    bigIdea: "Great leaders listen more than they talk, and when they talk, people understand them.",
    body: [
      "Most problems on a team are communication problems. Somebody assumed. Somebody didn't listen. Somebody said \"you always\" and the conversation was over.",
      "The fix is simple, and it takes practice like anything else. For the hardest conversations, run NITE.",
    ],
    lists: [
      {
        title: "Seven keys",
        points: [
          "Understand first. Get the whole story before you react or judge.",
          "Two ears, one mouth: listen twice as much as you talk. People who feel heard trust you.",
          "Listen with your eyes: eye contact, body language, the look on her face.",
          "Ask, don't assume. Ask questions, including why.",
          "Skip \"always,\" \"never\" and \"everybody.\" They shut people down.",
          "Talk to her, not about her.",
          "Serve first: lead by caring, supporting and asking what your teammate needs.",
        ],
      },
      {
        title: "NITE: the hard-conversation play",
        points: [
          "N is for Name: start with her name. It gets her attention and shows respect.",
          "I is for Information: then say the message, short and clear.",
          "T is for Tone: how you say it matters as much as what you say.",
          "E is for Eye contact: look at her, not at your phone or the ground.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Which key do you do best? Which one do you need most?" },
      { key: "q2", text: "Think of a time a misunderstanding hurt your team. Which key would have fixed it?" },
      { key: "q3", text: "Write how you'd use NITE in a hard conversation coming up." },
    ],
    steps: [
      { key: "s1", text: "In your next tough conversation, ask two questions before you say what you think." },
      { key: "s2", text: "Practice NITE out loud with a teammate or your coach before you need it." },
    ],
  },
  {
    slug: "accountability-starters",
    part: "Lead the team",
    title: "Accountability Starters",
    bigIdea: "Knowing what to say makes the hard conversation a whole lot easier to start.",
    body: [
      "Most players don't hold teammates accountable because they don't know what to say, and peer pressure makes it worse. So have the words ready.",
      "Put out the small fires yourself, quietly and early. The big ones go to your coach, and that's not snitching. That's leadership.",
    ],
    tool: "starters",
    questions: [
      { key: "q1", text: "Which starter would you actually say? Why that one?" },
      { key: "q2", text: "When would you use it, and with whom?" },
      { key: "q3", text: "Where's the line between a small fire you handle and one that goes to your coach?" },
    ],
    steps: [
      { key: "s1", text: "Practice two starters out loud with a teammate." },
      { key: "s2", text: "Find an accountability buddy and check in with each other every week." },
    ],
  },
  {
    slug: "team-talks",
    part: "Lead the team",
    title: "Lead a Team Talk",
    bigIdea: "Some of the best leading happens in a circle: players talking, everyone heard, and one thing to do when it's over.",
    body: [
      "A coach's speech only goes so far. Players leading players is what sticks. Pick one question, ask it, and then listen more than you talk.",
      "Run one a week: before practice, on the bus, after a game. Use one of these questions or a situation from What Would You Do? Every talk ends with a takeaway, one thing the team will do this week.",
    ],
    lists: [
      {
        title: "How to run it",
        points: [
          "Get your coach's OK and pick a time.",
          "Pick one question or one situation.",
          "Ask it, then let others answer first.",
          "If it's a situation, act it out loud like it's real.",
          "End with one takeaway the whole team can do this week.",
        ],
      },
      {
        title: "Questions that get a team talking",
        points: [
          "What makes someone a great leader? Who's an example around here?",
          "Which coach or mentor helped you most? What do you admire about them?",
          "Why does listening matter so much for a leader?",
          "How do we get everyone working toward the same goal?",
          "Can leadership be learned? What's your proof?",
          "How could our team give back to our school or town?",
          "What does empathy look like on a softball team?",
          "What makes it hard for players our age to lead? How do we get past it?",
          "How is leading a team different from leading a club or a group project?",
          "If you led this team tomorrow, what's the first thing you'd do?",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Which question would get your team talking? Why?" },
      { key: "q2", text: "Who usually stays quiet in team talks, and how will you bring her in?" },
      { key: "q3", text: "What takeaway would make the biggest difference for your team this week?" },
    ],
    steps: [
      { key: "s1", text: "Run one team talk with your coach's OK." },
      { key: "s2", text: "End it with one takeaway, and check on it a week later." },
    ],
  },
  {
    slug: "leadership-hacks",
    part: "Lead the team",
    title: "Leadership Hacks",
    bigIdea: "Small, simple things done every day build a team that wants to compete for each other.",
    body: ["You don't need a big speech to lead. Pick one of these, make it yours, and do it all season."],
    lists: [
      {
        title: "Hacks that work",
        points: [
          "A team mantra: let it come from the team, then live it all season.",
          "A breathing reset: lead the team through 30 seconds before a big game.",
          "Mini-competitions: turn a boring drill into a game.",
          "Mentor one younger player for the whole season.",
          "An inspiration board: photos, goals, moments that matter.",
          "A gratitude circle: everyone thanks one teammate.",
          "A two-minute check-in to open practice: how is everybody, really?",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Which hack fits you best? Why?" },
      { key: "q2", text: "What's a hack you've seen on another team that worked?" },
      { key: "q3", text: "What would go on your team's inspiration board?" },
    ],
    steps: [
      { key: "s1", text: "Pick one hack and run it this week." },
      { key: "s2", text: "Choose a younger teammate to mentor and tell her you've got her this season." },
    ],
  },
  {
    slug: "team-building",
    part: "Lead the team",
    title: "Build the Bond",
    bigIdea: "Teams that know each other trust each other, and trust shows up when the game gets tight.",
    body: [
      "Team-building isn't a day off. It's practice for trusting each other: talking under pressure, solving problems together, and getting to know the teammate you'd never sit with at lunch.",
      "Pick one, get your coach's OK, and run it. Mix up the groups every time: different grades, different friend groups. Afterward, lead a quick talk: what did that teach us about our team?",
    ],
    lists: [
      {
        title: "Activities that work",
        points: [
          "Human Knot: everyone grabs two hands across the circle, then untangles without letting go.",
          "Scavenger Hunt: small groups race the clock to find items or crack clues.",
          "Marshmallow Tower: build the tallest tower you can out of spaghetti and marshmallows.",
          "Minefield: talk a blindfolded teammate through an obstacle course with your voice only.",
          "Puzzle Swap: every group's puzzle has pieces mixed in from the others, so you have to trade.",
          "One-Hand Tower: partners build a card tower with one hand each, tied together.",
          "Team Charades: timed, scored, team words only.",
          "Team Canvas: paint one canvas together that shows a team value, then hang it up.",
          "Reflection Circle: pass a ball around. Whoever holds it answers the question while everyone else listens.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Which activity fits your team best, and why?" },
      { key: "q2", text: "Who on your team do you know the least?" },
      { key: "q3", text: "What do you want your team to learn from it?" },
    ],
    steps: [
      { key: "s1", text: "Plan one activity with your coach." },
      { key: "s2", text: "Run it, then lead the talk afterward." },
    ],
  },
  {
    slug: "leader-mistakes",
    part: "Lead the team",
    title: "Mistakes Leaders Make",
    bigIdea: "You don't have to be perfect. But big mistakes, or the same mistake twice, cost you the trust you need to lead.",
    body: ["Every leader messes up. Know the common ones so you see them coming."],
    lists: [
      {
        title: "Watch out for",
        points: [
          "Thinking a title makes you a leader.",
          "Coasting once you've been picked.",
          "Dodging the hard conversation, so the problem grows.",
          "Caving to peer pressure.",
          "Letting negativity build behind the scenes.",
          "Expecting perks because you're a leader.",
          "Not being one of the hardest workers.",
          "Bad choices away from the field.",
          "Talking badly about teammates or coaches. Everyone wonders if you talk about them too.",
          "Only celebrating the stars.",
          "Taking credit for wins and blaming others for losses.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Which mistake are you most likely to make? Be honest." },
      { key: "q2", text: "What have you seen happen to a team when a leader made one of these?" },
      { key: "q3", text: "How will you hold strong when peer pressure pushes the other way?" },
    ],
    steps: [
      { key: "s1", text: "Pick your riskiest mistake and write down how you'll catch yourself." },
      { key: "s2", text: "Ask a teammate you trust to call you out if she sees it." },
    ],
  },
  {
    slug: "it-only-takes-one",
    part: "Learn from the greats",
    title: "It Only Takes One",
    bigIdea: "One player can sink a team, and one player can save it. Be the one who saves it.",
    body: [
      "A researcher once planted an actor in small groups that had a job to do. Sometimes he played the jerk, sometimes the slacker, sometimes the downer. Every time, the group did a lot worse, and the others started acting like him. When he played the downer, the whole room went flat.",
      "Except one group. One member there kept defusing him: leaning in, staying upbeat, asking questions and steering everyone back to the work. That group did the best of all.",
      "Picture a college coach choosing between two recruits. One is the better player, but she stays out late the night before games and takes teammates with her, and they're the ones who play flat in the morning. The other is a little less talented, and she's the one who keeps everyone in the hotel the night before the championship game. The coach takes the second one every time. Influence spreads both ways. Which way will yours go?",
    ],
    lists: [
      {
        title: "What it teaches",
        points: [
          "One person shapes a team, in either direction.",
          "Negativity spreads unless someone stops it.",
          "Leaders defuse it: calm, positive, back to work.",
          "Culture happens every day, in small moments.",
          "Deal with it directly. Ignoring it lets it grow.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Why does one person's negativity spread so fast?" },
      { key: "q2", text: "What can you do the moment you feel negative energy creeping in?" },
      { key: "q3", text: "Who keeps your team in the hotel the night before a big tournament? Is it you?" },
    ],
    steps: [
      { key: "s1", text: "The next time negativity starts, be the first positive voice." },
      { key: "s2", text: "Ask a teammate who seems down how she's doing, and mean it." },
    ],
  },
  {
    slug: "make-everyone-better",
    part: "Learn from the greats",
    title: "Make Everyone Better",
    bigIdea: "The best players make the people around them better. That's leadership you can see from the bleachers.",
    body: [
      "Caitlin Clark plays basketball, not softball, but watch her and you'll see leadership that works on any diamond. She believes she'll make the play, and her teammates start believing too. To her, setting up a teammate matters as much as scoring herself.",
      "You don't need her range to lead like that. Here are ten things her game shows, and what each one looks like on a softball field.",
    ],
    lists: [
      {
        title: "Ten things to take from her game",
        points: [
          "Confidence that spreads: walk to the plate like you expect to win the at-bat, and the dugout believes it too.",
          "Make everyone around you better: the sac bunt that moves a runner matters as much as the home run.",
          "Calm in the clutch: bases loaded, two outs, last inning. The bigger the moment, the steadier the leader.",
          "Relentless work: elite skill gets built in tee work and bullpens nobody films.",
          "Bounce back: an error, a strikeout, a bad call, then right back to the next pitch.",
          "Be consistent: teammates know exactly what they'll get from you, every inning.",
          "Demand excellence: from yourself first, then from your team.",
          "Want the challenge: the toughest pitcher, the biggest game, the ball hit to you.",
          "Talk constantly: call the outs, the cuts and the coverages, every pitch.",
          "Stay humble: credit your teammates and your coaches.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Which of the ten do you already bring?" },
      { key: "q2", text: "Which one will you build next, and how?" },
      { key: "q3", text: "Who on your team makes everyone around her better? What does she do?" },
    ],
    steps: [
      { key: "s1", text: "Pick one of the ten and do it on purpose at every practice this week." },
      { key: "s2", text: "Make a teammate better: help her with something she's working on." },
    ],
  },
  {
    slug: "lead-when-its-hardest",
    part: "Learn from the greats",
    title: "Lead When It's Hardest",
    bigIdea: "When everything falls apart, the leader's job is simple: keep everyone together and get everyone home.",
    body: [
      "In 1914, the explorer Ernest Shackleton sailed for Antarctica on a ship called the Endurance. The ship got trapped in the ice, then crushed, then sank. His crew was stranded on the ice for months with no way to call for help.",
      "The mission was over, so a new one started: get everyone home. Nearly two years after they set sail, every member of the crew was rescued.",
      "Your season will never be that hard. But the lessons from the ice work in any dugout.",
    ],
    lists: [
      {
        title: "Ten lessons from the ice",
        points: [
          "Stay calm in a crisis. Panic spreads, and so does calm.",
          "People before the plan. Take care of your teammates first.",
          "Share the hard work. Leaders carry the gear too.",
          "Adapt. When the goal changes, change with it.",
          "Stay positive when it's hardest. Your team reads your face.",
          "Decide under pressure. A good call now beats a perfect call too late.",
          "Keep morale up: routines, small wins, a little fun to break the grind.",
          "Trust your team. Give people real jobs.",
          "Be caring and tough at the same time.",
          "Never give up.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Which lesson would help your team most right now?" },
      { key: "q2", text: "When did a season or a game change on you? How did you adapt?" },
      { key: "q3", text: "How do you keep morale up during a losing streak?" },
    ],
    steps: [
      { key: "s1", text: "In your next tough practice, be the calmest person on the field." },
      { key: "s2", text: "Do one small thing to break the grind for your team this week." },
    ],
  },
  {
    slug: "habits",
    part: "Keep climbing",
    title: "Habits of Great Leaders",
    bigIdea: "Leadership isn't a destination. It's habits you build one day at a time.",
    body: ["Go through the list. Mark the habits that are already strengths, and the ones you're working on. Then pick one to build next."],
    tool: "habits",
    questions: [
      { key: "q1", text: "Which habit is your biggest strength? How does it help your team?" },
      { key: "q2", text: "Which habit will you build next, and how?" },
      { key: "q3", text: "How will you make it part of every day, not just a good week?" },
    ],
    steps: [
      { key: "s1", text: "Mark every habit as a strength or something you're working on." },
      { key: "s2", text: "Practice your next habit every day for two weeks." },
    ],
  },
  {
    slug: "team-leader-checklist",
    part: "Keep climbing",
    title: "What Your Coach Expects",
    bigIdea: "Here's what your coach expects from a team leader, all season long.",
    body: [
      "Before the season, your coach sits down with the team leaders and goes over what's expected. Your coach will build a relationship with you, meet with you often and talk through situations before they happen. Here's your side of the deal. Come back to this list all season.",
    ],
    lists: [
      {
        title: "Eight expectations",
        points: [
          "Make good choices, the kind your teammates would be proud of.",
          "Put out small fires before they turn into big ones.",
          "Own it: your mistakes and your role. No blaming, no excuses, and don't let teammates make them either.",
          "Be the thermostat, not the thermometer: set the team's temperature at practice and in games instead of reacting to it.",
          "We over me: see everything through the team's eyes. Bring in the teammate who's left out. Lift the one who's frustrated about playing time.",
          "Bring the energy-giving plays: high fives, fist bumps, a hand on the shoulder, encouragement when it's hard.",
          "Build your teammates' confidence with honest words that bring out their best.",
          "Guard the culture all season, side by side with your coaches.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Which expectation do you already own?" },
      { key: "q2", text: "Which one is hardest for you? Why?" },
      { key: "q3", text: "When should you step in early, before a small problem gets big?" },
    ],
    steps: [
      { key: "s1", text: "Go through the list with your coach." },
      { key: "s2", text: "Set one goal from the list for the next two weeks." },
    ],
  },
  {
    slug: "scenarios",
    part: "Keep climbing",
    title: "What Would You Do?",
    bigIdea: "Leaders practice the hard moments before they happen.",
    body: [
      "Read each situation and write what you'd do. Then open the leader's move and compare. There's more than one good answer.",
      "Best way to use these: one a week with your team, the leaders running the talk, and everyone saying their answer out loud like it's real.",
    ],
    tool: "scenarios",
    questions: [
      { key: "q1", text: "Which situation would be hardest for you? Why?" },
      { key: "q2", text: "What's one lesson from these you'll use this week?" },
      { key: "q3", text: "How will you hold yourself accountable for using it?" },
    ],
    steps: [
      { key: "s1", text: "Talk through one situation a week with your coach or your team." },
      { key: "s2", text: "Act one out with a teammate: one of you is the leader, one the player." },
    ],
  },
  {
    slug: "rate-yourself",
    part: "Keep climbing",
    title: "Rate Your Leadership",
    bigIdea: "Know where you stand. Rate yourself honestly, then see how your coach sees you.",
    body: [
      "Rate yourself from 1 to 5 in each area. Each one shows what a 5 looks like. Your coach rates you too. Where you see it differently is the most useful part.",
    ],
    tool: "rubric",
    questions: [
      { key: "q1", text: "Where are you strongest? Where's your biggest room to grow?" },
      { key: "q2", text: "Where do you and your coach see it differently? Why do you think that is?" },
      { key: "q3", text: "What's one thing you'll do to move up a level?" },
    ],
    steps: [
      { key: "s1", text: "Rate yourself in every area." },
      { key: "s2", text: "Talk through your ratings with your coach or a mentor." },
    ],
  },
  {
    slug: "keep-growing",
    part: "Keep climbing",
    title: "Keep Climbing",
    bigIdea: "Leadership never arrives. It's a choice you make again every day, for the rest of your life.",
    body: [
      "You'll lead in places that have nothing to do with softball: at school, at home, at work, in your community. Everything in this guide goes with you.",
      "Your next move is your plan. Write it, share it with your coach, and keep coming back to it. Find a mentor. Lead a project. Learn from leaders you admire. And one day, help train the next leader. That's your legacy.",
    ],
    questions: [
      { key: "q1", text: "What's the biggest way you've grown as a leader so far?" },
      { key: "q2", text: "What challenge do you expect next, and how will you beat it?" },
      { key: "q3", text: "Who will you help become a leader?" },
    ],
    steps: [
      { key: "s1", text: "Write your Leadership Plan." },
      { key: "s2", text: "Lead one project this season: a team event, a service day, a new tradition." },
    ],
  },
]);

// ---------------------------------------------------------------------------
// Extra Reps: optional short lessons, any order, not needed for the certificate
// ---------------------------------------------------------------------------

export const BONUS: Lesson[] = bonus([
  {
    slug: "title-or-choice",
    part: "Lead",
    title: "Title or Choice",
    bigIdea: "Captain is a title someone gives you. Leader is a choice you make.",
    body: [
      "The captain's patch doesn't always go to the real leader, and the best player isn't always the one people follow. Titles get handed out. Influence gets earned.",
      "Picture a team that's down 5-0 after three innings: flat, quiet, kicking the ball around. Between innings, one player calls everyone to the dugout rail. She says what needs saying, and the team owns it. By the time they take the field again, they're ready to play. That's leadership, patch or no patch.",
    ],
    lists: [{ title: "Leaders choose to", points: ["Lead by example.", "Cheer.", "Connect.", "Confront.", "Challenge."] }],
    questions: [
      { key: "q1", text: "What's the difference between a title and a choice?" },
      { key: "q2", text: "Have you seen a captain who wasn't the real leader? What happened?" },
      { key: "q3", text: "Why lead if nobody gives you a title?" },
    ],
    steps: [
      { key: "s1", text: "Rate yourself this week on the five: example, cheer, connect, confront, challenge." },
      { key: "s2", text: "Pick a leader you admire and borrow one thing she does." },
    ],
  },
  {
    slug: "lead-every-day",
    part: "Lead",
    title: "Lead Every Day",
    bigIdea: "You don't get to pick the days you lead. Your team is watching every one of them.",
    body: [
      "Leading on the good days is easy. The test is the cold Tuesday practice, the day after an 0-for-4, the week you're tired of everything. If you only lead when you feel like it, your teammates learn they can't count on you.",
      "So it starts with a choice: you want it, and you accept what comes with it. Then you set the example. Again tomorrow. And the day after that.",
    ],
    questions: [
      { key: "q1", text: "Why does leadership have to be a choice?" },
      { key: "q2", text: "What day of the week is hardest for you to lead? Why?" },
      { key: "q3", text: "What happens to a team when a leader only shows up some days?" },
    ],
    steps: [
      { key: "s1", text: "Start a streak: one lead-by-example act every day for two weeks." },
      { key: "s2", text: "Watch what changes on your team when you do, and write it down." },
    ],
  },
  {
    slug: "connect-first",
    part: "Lead",
    title: "Connect First",
    bigIdea: "Yelling isn't leading. People follow the teammate they trust.",
    body: [
      "Plenty of players think leading means being the loudest voice. Then they find out nobody's listening. Teammates follow someone they know has their back, and that takes a relationship.",
      "Connection comes first. Know your teammates: what's going on in their lives, what fires them up, what scares them. Then when you need to push, they'll let you.",
    ],
    questions: [
      { key: "q1", text: "How do relationships help you lead?" },
      { key: "q2", text: "What builds trust fastest?" },
      { key: "q3", text: "Who's a leader whose connection changed a team?" },
    ],
    steps: [
      { key: "s1", text: "Connect with someone new on the team every week." },
      { key: "s2", text: "Ask a teammate about something outside softball, and remember it." },
    ],
  },
  {
    slug: "first-to-join",
    part: "Lead",
    title: "Be the First to Join",
    bigIdea: "The first person to join turns one person with an idea into a leader. Sometimes that's the bravest move on the field.",
    body: [
      "One person doing something different looks a little out there. When a second person joins, a movement starts. The first follower shows everyone else it's safe to jump in, and the crowd follows her, not just the one who started it.",
      "Being a great follower is part of being a great leader. When a teammate starts something right, like a new warmup, a cheer or extra reps, be the first to back her.",
    ],
    questions: [
      { key: "q1", text: "Why does the first follower matter so much?" },
      { key: "q2", text: "When have you seen a first follower change a team?" },
      { key: "q3", text: "How does following well make you a better leader?" },
    ],
    steps: [
      { key: "s1", text: "Be the first to join a teammate doing something right this week." },
      { key: "s2", text: "Notice who joined you when you led. Thank her." },
    ],
  },
  {
    slug: "cost-of-leading",
    part: "Lead",
    title: "The Cost of Leading",
    bigIdea: "Leading costs something. Know the price up front, and pay it anyway.",
    body: [
      "Nobody puts this on a poster, but leadership has a price. Great leaders know it going in. They don't need everyone to like them. They need to do what's right for the team.",
    ],
    lists: [
      {
        title: "The price",
        points: [
          "Some hard calls will hurt people you care about.",
          "Some people won't like you, even when you do what's best for the team.",
          "You'll be misunderstood, and you can't always explain why.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Why do you think nobody talks about the cost of leading?" },
      { key: "q2", text: "What's a hard decision you've made for a team?" },
      { key: "q3", text: "How will you handle it when someone doesn't like you for doing the right thing?" },
    ],
    steps: [
      { key: "s1", text: "Write about a hard call you made and what it cost you." },
      { key: "s2", text: "Ask another leader how she handles being disliked." },
    ],
  },
  {
    slug: "earn-the-right",
    part: "Lead",
    title: "Earn the Right to Speak",
    bigIdea: "The teammate who outworks everyone earns the right to challenge everyone.",
    body: [
      "Some of the most powerful pregame talks come from players who aren't the most talented on the team. People listen because of how they work: every day, every rep, no shortcuts. They've earned it.",
      "That's the order. Hold yourself accountable first. Then you can ask your teammates to play for each other, and they'll hear you.",
    ],
    questions: [
      { key: "q1", text: "How does a player earn the right to challenge her teammates?" },
      { key: "q2", text: "How does holding yourself accountable change team chemistry?" },
      { key: "q3", text: "Tell about a time you owned a mistake. What happened next?" },
    ],
    steps: [
      { key: "s1", text: "Pick one area to hold yourself accountable in, and make a specific plan." },
      { key: "s2", text: "Help your coach write the team's accountability guidelines." },
    ],
  },
  {
    slug: "positive-energy",
    part: "Lead",
    title: "Positive Energy Is Contagious",
    bigIdea: "Energy spreads. Make sure yours is worth catching.",
    body: [
      "Think of a coach or teammate who walked into a team full of doubt and won everyone over with care and optimism. That's what positive energy does to a dugout.",
      "You don't have to be cheerful every second. But a leader's energy sets the tone, and positive energy builds trust. That trust is what lets you have the hard conversation later without losing her.",
    ],
    questions: [
      { key: "q1", text: "How does a leader's energy change a team?" },
      { key: "q2", text: "Tell about a time someone's energy made the difference." },
      { key: "q3", text: "How do you stay positive and still call out what's wrong?" },
    ],
    steps: [
      { key: "s1", text: "Give a teammate a real shout-out every day this week." },
      { key: "s2", text: "Check in with one teammate a week, just to ask how she's doing." },
      { key: "s3", text: "Rate how steady your energy was this week, 1 to 10." },
    ],
  },
  {
    slug: "lead-from-the-bench",
    part: "Team and culture",
    title: "Lead From the Bench",
    bigIdea: "Your role can change in a second. Your teamwork shouldn't.",
    body: [
      "Picture this: the Women's College World Series, a huge at-bat, and the coach sends up a pinch hitter for an All-American. She could sulk. Instead she's the loudest voice in the dugout, cheering for the player who took her spot.",
      "Staying selfless when a call goes against you is leadership. Cheering from the bench is a skill, and the best teams make it normal.",
    ],
    questions: [
      { key: "q1", text: "What makes a player a great teammate when things don't go her way?" },
      { key: "q2", text: "Why might a coach make a call like that?" },
      { key: "q3", text: "How does a cheering dugout change the way a team plays?" },
    ],
    steps: [
      { key: "s1", text: "Next time you're on the bench, be the loudest supporter in the dugout." },
      { key: "s2", text: "With your team, name the habits that make cheering for each other normal." },
    ],
  },
  {
    slug: "connected-teams",
    part: "Team and culture",
    title: "Connected Teams Win",
    bigIdea: "Talent sets your floor. Connection decides your ceiling.",
    body: [
      "A talented team that doesn't care about each other hits a wall. A team that's honestly connected plays with energy and purpose. They play for each other, and that's hard to beat.",
      "Connection doesn't happen by accident. It takes every voice being heard, and knowing each other as people, not just as positions.",
    ],
    questions: [
      { key: "q1", text: "What does a connected team look like?" },
      { key: "q2", text: "What's a connected team you've been on or watched?" },
      { key: "q3", text: "What gets in the way of connection on your team?" },
    ],
    steps: [
      { key: "s1", text: "Make sure every voice gets heard in your next huddle or team meeting." },
      { key: "s2", text: "Pair up with a teammate as accountability buddies for the season." },
    ],
  },
  {
    slug: "high-fives-win",
    part: "Team and culture",
    title: "High Fives Win Games",
    bigIdea: "High fives, fist bumps and huddles aren't extras. They're how teams build trust.",
    body: [
      "Researchers once counted how often NBA players touched each other early in a season: high fives, fist bumps, chest bumps, huddles. The teams that touched the most tended to win the most. They trusted each other, cooperated more and played less selfishly. The teams that touched less, with negative body language, played more for themselves.",
      "Softball has more of those moments than any sport: the high five at home plate, the fist bump when a teammate comes off the field, the huddle in the circle. Every one says I'm with you. That's an energy-giving play, and you can bring it every inning.",
    ],
    questions: [
      { key: "q1", text: "How does a high five or a tap on the helmet build trust?" },
      { key: "q2", text: "When did a teammate's gesture lift you?" },
      { key: "q3", text: "How can you connect with a teammate who doesn't love high fives?" },
    ],
    steps: [
      { key: "s1", text: "Count your team's high fives, fist bumps and huddles in one game." },
      { key: "s2", text: "List your team's energy-giving plays with your teammates, then bring more of them." },
    ],
  },
  {
    slug: "no-shortcuts",
    part: "Team and culture",
    title: "No Shortcuts Around You",
    bigIdea: "Your own effort isn't enough if you accept less from the people around you.",
    body: [
      "You can do every rep right and still let the team down, if you watch a teammate cut a corner and say nothing. Accepting average around you is a choice too.",
      "Holding the standard means speaking up: respectfully, with a solution, and with your own effort as proof.",
    ],
    questions: [
      { key: "q1", text: "Why does accountability matter on a team?" },
      { key: "q2", text: "How can you confront a teammate in a way that helps?" },
      { key: "q3", text: "How has someone challenging you made you better?" },
    ],
    steps: [
      { key: "s1", text: "Notice where corners get cut on your team, and write down what you'd say." },
      { key: "s2", text: "Practice the conversation out loud with a teammate." },
      { key: "s3", text: "Set the bar yourself: no shortcuts this week." },
    ],
  },
  {
    slug: "everyone-on-the-bus",
    part: "Team and culture",
    title: "Everyone on the Bus",
    bigIdea: "Great culture starts when everyone buys into the same standards.",
    body: [
      "Players who push hard and players who settle don't mix well. Picking the roster is the coach's job. Getting everyone to buy in is the leaders' job.",
      "Start with your non-negotiables: the few things this team always does, no matter what. Write them down. Then everyone signs.",
    ],
    questions: [
      { key: "q1", text: "What does it mean to have the right people on a team?" },
      { key: "q2", text: "What happens when some players don't buy in?" },
      { key: "q3", text: "What can a leader do when a teammate isn't bought in?" },
    ],
    steps: [
      { key: "s1", text: "Work with your coach and team to write your non-negotiables." },
      { key: "s2", text: "Make it a poster, and have everyone sign it." },
    ],
  },
  {
    slug: "who-you-are",
    part: "Character",
    title: "Who You Are Every Day",
    bigIdea: "Character is when what you do, what you say and how you live all match.",
    body: [
      "Nobody hands you character. You build it every day, one small decision at a time. Your actions say more than your words ever will.",
      "When your actions and your words don't match, your teammates notice, and they trust the actions.",
    ],
    questions: [
      { key: "q1", text: "What does character mean to you?" },
      { key: "q2", text: "Why do your actions, your words and your life need to line up?" },
      { key: "q3", text: "How do small choices add up to who you are?" },
    ],
    steps: [
      { key: "s1", text: "Check this week's choices against your values. Where don't they match?" },
      { key: "s2", text: "Ask someone you trust how you come across." },
      { key: "s3", text: "Do one act of kindness for a teammate every day this week." },
    ],
  },
  {
    slug: "control-what-you-control",
    part: "Character",
    title: "Control What You Control",
    bigIdea: "Make your best choices every day, and let go of what you can't control.",
    body: [
      "Worrying about the wrong things keeps you from your best: the umpire, the lineup, what people are saying. None of that is yours. Your effort, your attitude, your preparation and your next choice are.",
      "Good choices made over and over build influence. Influence is leadership. And over time, that's what wins.",
    ],
    lists: [
      {
        title: "Sort it",
        points: [
          "Mine: effort, attitude, preparation, body language, how I treat people.",
          "Not mine: the umpire, the weather, the lineup, other people's opinions.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "How do your daily choices shape who you are?" },
      { key: "q2", text: "What do you waste energy on that you can't control?" },
      { key: "q3", text: "How does doing the right thing over and over add up?" },
    ],
    steps: [
      { key: "s1", text: "Make two lists: what you control and what you don't. Let go of the second one." },
      { key: "s2", text: "With your team, write down the values you share." },
    ],
  },
  {
    slug: "small-stuff",
    part: "Character",
    title: "Sweat the Small Stuff",
    bigIdea: "If you skip the little things, you won't handle the big ones.",
    body: [
      "Picture a team talking big about its season, then every single player walking past an empty water bottle on the dugout floor. Nobody picks it up. That team was never as good as it talked.",
      "Big goals are built out of small details: how you warm up, how you take care of your gear, how you show up. Get those right and the big things follow.",
    ],
    questions: [
      { key: "q1", text: "What does that story say about a team?" },
      { key: "q2", text: "How do details shape character?" },
      { key: "q3", text: "Which little things lead to your big goals?" },
    ],
    steps: [
      { key: "s1", text: "List three daily details you'll do better." },
      { key: "s2", text: "Lead a quick team talk on the small things you'll all do." },
    ],
  },
  {
    slug: "leave-it-better",
    part: "Character",
    title: "Leave It Better",
    bigIdea: "Lead yourself first. Then leave every place better than you found it.",
    body: [
      "Some of the best athletes in any sport are known for cleaning up after their team: the dugout, the bus, the locker room. Nobody asked them to. They know that how you do the small things is how you do everything.",
      "Leave the dugout, the bus and the field cleaner than you found them. It's a small thing. That's the point.",
    ],
    questions: [
      { key: "q1", text: "Why should a leader clean up after the team?" },
      { key: "q2", text: "Why does leaving it better matter?" },
      { key: "q3", text: "How does skipping the small stuff spill into everything else?" },
    ],
    steps: [
      { key: "s1", text: "Be the last one out of the dugout, and leave it clean." },
      { key: "s2", text: "Start a leave-it-better routine with your team." },
    ],
  },
  {
    slug: "feel-it-then-choose",
    part: "Mental toughness",
    title: "Feel It, Then Choose",
    bigIdea: "Feelings come and go. Feel them, then choose what you do next.",
    body: [
      "Every player gets nervous in the box, angry after a bad call, frustrated after an error. Pretending you don't is how those feelings take over. Accept them instead, then decide what to do with them.",
      "Pause before you react. The breath between the feeling and the action is where your poise lives. And just because a negative thought shows up doesn't mean you have to believe it.",
    ],
    questions: [
      { key: "q1", text: "Why accept your emotions instead of fighting them?" },
      { key: "q2", text: "How does pausing before you react help?" },
      { key: "q3", text: "When do negative thoughts hurt your play most?" },
    ],
    steps: [
      { key: "s1", text: "Take one minute a day to notice what you're feeling." },
      { key: "s2", text: "Keep a thought journal for a week: the negative thought, what set it off, and a better thought." },
      { key: "s3", text: "Swap one negative thought for a useful one, out loud." },
    ],
  },
  {
    slug: "back-yourself",
    part: "Mental toughness",
    title: "Back Yourself",
    bigIdea: "Believe in yourself before anyone else does, then work like you mean it.",
    body: [
      "Plenty of great players started on the bench, got cut once, or batted ninth for a season. What they had was belief in themselves and a stubborn refusal to stop working.",
      "Confidence isn't bragging. It's knowing what you've put in. Great leaders pair that belief with high standards.",
    ],
    questions: [
      { key: "q1", text: "Where does real self-belief come from?" },
      { key: "q2", text: "How does believing in yourself help you bounce back?" },
      { key: "q3", text: "Tell about a time you doubted yourself. What happened?" },
    ],
    steps: [
      { key: "s1", text: "Write down your strengths and three things you're proud of." },
      { key: "s2", text: "Set a small goal, track it, and celebrate when you hit it." },
      { key: "s3", text: "Spend more time with people who believe in you." },
    ],
  },
  {
    slug: "be-where-your-feet-are",
    part: "Mental toughness",
    title: "Be Where Your Feet Are",
    bigIdea: "Poise means playing this pitch, not the last one or the next one.",
    body: [
      "The last error is gone. The next at-bat isn't here yet. The only pitch you can do anything about is this one.",
      "Staying present helps you make better decisions, stay calm under pressure and actually enjoy the game. Letting go of distractions is what poise is.",
    ],
    questions: [
      { key: "q1", text: "How does staying present give you poise?" },
      { key: "q2", text: "What pulls you out of the moment?" },
      { key: "q3", text: "Tell about a time staying present helped you." },
    ],
    steps: [
      { key: "s1", text: "Build a reset routine: a breath, a word, a spot to look at." },
      { key: "s2", text: "Use it after every mistake this week." },
      { key: "s3", text: "Notice a moment you weren't present, and what pulled you away." },
    ],
  },
  {
    slug: "poise-wins",
    part: "Mental toughness",
    title: "Poise Wins",
    bigIdea: "Skill plus calm is almost impossible to beat.",
    body: [
      "For the best players, the game seems to slow down. A lot of that is how they carry themselves: calm, steady, in control.",
      "Poise can be built. Here's what it's made of.",
    ],
    lists: [
      {
        title: "Seven parts of poise",
        points: [
          "Handles pressure.",
          "Thinks instead of just reacting.",
          "Stays consistent.",
          "Adapts to change.",
          "Leads.",
          "Stays mentally tough.",
          "Respects opponents, umpires and the game.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Can poise be learned? How?" },
      { key: "q2", text: "Who's an athlete with poise you admire? What does she do?" },
      { key: "q3", text: "How does poise connect to leadership?" },
    ],
    steps: [
      { key: "s1", text: "Rate yourself 1 to 5 on each part of poise, and pick one to work on." },
      { key: "s2", text: "Practice under pressure: turn one drill into a game with something on the line." },
    ],
  },
  {
    slug: "work-beats-fear",
    part: "Mental toughness",
    title: "Work Beats Fear",
    bigIdea: "Fear shrinks when you know you've done the work.",
    body: [
      "The best players aren't scared to be up with the game on the line, because they've already taken thousands of swings in practice. Confidence is earned in the cage and the bullpen, one day at a time.",
      "Fake confidence talks big and cracks under pressure, and it hurts the team when it does. Real confidence comes from the process.",
    ],
    questions: [
      { key: "q1", text: "How are work ethic and confidence connected?" },
      { key: "q2", text: "What's a fear you beat? How?" },
      { key: "q3", text: "Is confidence earned or given?" },
    ],
    steps: [
      { key: "s1", text: "Write about a time fear held you back." },
      { key: "s2", text: "List the practice habits that make you fearless, and do them." },
    ],
  },
  {
    slug: "put-in-the-work",
    part: "Mental toughness",
    title: "You Get What You Put In",
    bigIdea: "There's no shortcut. You get out what you put in.",
    body: [
      "Nothing in, nothing out. The best put in the time: the extra cage rounds, the bullpens in January, the long toss when it's boring and nobody's watching. People who chase shortcuts find that out the hard way.",
      "Leaders have to be among the hardest workers on the team. Otherwise nobody listens.",
    ],
    questions: [
      { key: "q1", text: "Do you agree that you get out what you put in? Why?" },
      { key: "q2", text: "Does a leader need to be one of the hardest workers?" },
      { key: "q3", text: "Why do people chase shortcuts?" },
    ],
    steps: [
      { key: "s1", text: "Rate your commitment honestly, 1 to 10." },
      { key: "s2", text: "Set one goal and three daily habits that get you there." },
      { key: "s3", text: "Track those habits for two weeks." },
    ],
  },
  // Know your why (SB Blueprint #75, user 2026-11-08): short reflection reps
  {
    slug: "why-i-play",
    part: "Know your why",
    title: "Why I Play",
    bigIdea: "Your why is what you hold on to when the game gets hard.",
    body: [
      "Everybody loves softball on the days you go 3-for-3. Your why is for the other days: the 0-for-4, the error that cost a run, the 6 a.m. bus to a tournament in the rain.",
      "It doesn't have to sound impressive. Maybe it's your teammates, the feeling of a perfect throw, the player you want to become or the people who drive you to every game. It has to be true, and it has to be yours.",
    ],
    questions: [
      { key: "q1", text: "Why do you play? Write it in one sentence." },
      { key: "q2", text: "When was the last time your why kept you going?" },
      { key: "q3", text: "Who do you play for besides yourself?" },
    ],
    steps: [
      { key: "s1", text: "Write your why on a card and keep it in your bat bag." },
      { key: "s2", text: "Read it before your next tournament." },
    ],
  },
  {
    slug: "how-i-want-to-be-remembered",
    part: "Know your why",
    title: "How I Want to Be Remembered",
    bigIdea: "Your teammates won't remember your batting average. They'll remember how you made them feel.",
    body: [
      "Picture the last game of your career. What would you want your teammates to say about you in the dugout afterward? Not your stats: who you were.",
      "That answer is a plan. If you want to be the teammate who picked everyone up, start picking people up today. Every practice is a chance to be remembered the right way.",
    ],
    questions: [
      { key: "q1", text: "What three words do you want teammates to use about you?" },
      { key: "q2", text: "What did you do this week that matches those words?" },
      { key: "q3", text: "What's one thing you'd change so they fit even better?" },
    ],
    steps: [
      { key: "s1", text: "Ask one teammate which word she'd use for you right now." },
      { key: "s2", text: "Do one thing at the next practice that earns one of your three words." },
    ],
  },
  {
    slug: "my-why-on-hard-days",
    part: "Know your why",
    title: "My Why on Hard Days",
    bigIdea: "Plan for the hard day before it comes.",
    body: [
      "Hard days are coming: a slump, a benching, an injury, a coach's tough feedback. Players who know their why bounce back faster because they already know what they're fighting for.",
      "Decide now what you'll tell yourself on that day, and who you'll talk to. A leader has a plan for her own bad day, so she can still be there for her team.",
    ],
    questions: [
      { key: "q1", text: "What's the hardest day you've had in softball? What got you through it?" },
      { key: "q2", text: "What will you tell yourself the next time it happens?" },
      { key: "q3", text: "Who will you talk to?" },
    ],
    steps: [
      { key: "s1", text: "Write a two-sentence note to yourself for your next hard day." },
      { key: "s2", text: "Tell one person on your team or at home that they're your call on a hard day." },
    ],
  },
]);

// ---------------------------------------------------------------------------
// Leadership Light: the heart of the guide for players 11 and under. Eight short
// lessons, a short plan, the coach's sign-off. Same voice, simpler words: never
// babyish, never cutesy, no emoji. Slugs start with "light-".
// ---------------------------------------------------------------------------

export const LIGHT_INTRO = [
  "Your coach picked you for this because they see a leader in you. Leading doesn't mean being perfect, the oldest or the best player. It means making your team better.",
  "Eight short lessons. Read each one, answer the questions, and take the challenges to practice. Then write your leader plan, get your coach's sign-off, and earn your certificate.",
];

/** What the eight lessons build, shown on the program's first page and the certificate. */
export const LIGHT_KEYS = ["Choose to lead", "Give your best", "Lead by example", "Lift your teammates", "Protect your team"] as const;

export const LIGHT_LESSONS: Lesson[] = light([
  {
    slug: "light-what-is-a-leader",
    part: "Lead yourself",
    title: "What Is a Leader?",
    bigIdea: "A leader makes her team better. You don't need a title to do it.",
    body: [
      "A leader isn't always the oldest, the loudest or the best player on the field. A leader is anyone who helps her team get better: by how she works, how she talks and how she treats people.",
      "That means you can lead right now. Every practice and every game, what you do rubs off on your teammates. Leaders make sure it rubs off the right way.",
    ],
    lists: [
      {
        title: "Leaders on our team",
        points: [
          "Hustle on and off the field.",
          "Cheer for teammates, even from the bench.",
          "Pick up the gear without being asked.",
          "Tell a teammate \"nice play\" and mean it.",
          "Listen the first time the coach talks.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "Who's a leader you look up to? What does she do that makes people want to follow her?" },
      { key: "q2", text: "What's one way you already help your team?" },
    ],
    steps: [
      { key: "s1", text: "Do one thing at practice this week that helps the team, without being asked." },
      { key: "s2", text: "Tell a teammate one thing she did well." },
    ],
  },
  {
    slug: "light-choose-to-lead",
    part: "Lead yourself",
    title: "Choose to Lead",
    bigIdea: "Leading is a choice you make every day, not something you wait for.",
    body: [
      "Nobody hands you leadership. You choose it. You choose to show up ready, to try your hardest, and to be a good teammate, even when you're tired or things aren't going your way.",
      "Leaders own their stuff. When you make a mistake, say so, fix it and move on. No excuses, and no blaming the umpire, the field or a teammate.",
    ],
    questions: [
      { key: "q1", text: "What does choosing to lead look like at your next practice?" },
      { key: "q2", text: "Think of a mistake you made. How could you own it like a leader?" },
    ],
    steps: [
      { key: "s1", text: "When you mess up this week, say \"that's on me\" and get ready for the next play." },
      { key: "s2", text: "Get to practice early and ready, with all your gear." },
    ],
  },
  {
    slug: "light-all-in",
    part: "Lead yourself",
    title: "All In",
    bigIdea: "Bring your best effort and your best attitude, every inning and every practice.",
    body: [
      "Being all in means your body, your focus and your attitude all show up. You run hard to first even on a routine grounder. You stay locked in out in right field, even when nothing's been hit to you for three innings.",
      "Effort and attitude are two things you control every single day. Nobody can take them away from you, and your teammates notice when you bring them.",
    ],
    lists: [
      {
        title: "All in looks like",
        points: [
          "Sprinting on and off the field.",
          "Running out every ball you hit.",
          "Backing up every play.",
          "Staying in the game from the dugout.",
          "Going hard at the drill you don't love.",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "When is it hardest for you to stay all in? What can you do about it?" },
      { key: "q2", text: "What's one thing you'll do at every practice to show you're all in?" },
    ],
    steps: [
      { key: "s1", text: "Run out every ball you hit this week, all the way through first base." },
      { key: "s2", text: "Pick one drill you don't love and give it your best effort." },
    ],
  },
  {
    slug: "light-actions-first",
    part: "Lead yourself",
    title: "Actions Speak Loudest",
    bigIdea: "Your teammates watch what you do more than they listen to what you say.",
    body: [
      "It's easy to tell people to work hard. Leaders show them. Want your team to hustle? Hustle first. Want the dugout clean? Clean it first.",
      "Do the little things right, even when nobody's watching: listen the first time, help carry the equipment, and follow the team rules at practice, at games and in the dugout.",
    ],
    questions: [
      { key: "q1", text: "What's something you want your team to do better? How can you show them first?" },
      { key: "q2", text: "What's a little thing you could do right that nobody would even notice?" },
    ],
    steps: [
      { key: "s1", text: "Help carry or clean up the team's gear after practice." },
      { key: "s2", text: "Be the first one in when the coach calls the team together." },
    ],
  },
  {
    slug: "light-great-teammate",
    part: "Lead your team",
    title: "Be a Great Teammate",
    bigIdea: "People follow teammates they trust, and trust starts with how you treat people.",
    body: [
      "Get to know every teammate, not just your best friend on the team. Learn something about each of them outside of softball. Warm up with someone new. Make sure nobody sits alone in the dugout.",
      "Great teammates are happy for each other. When a teammate makes a great play or gets a big hit, be the first one out of the dugout to celebrate.",
    ],
    questions: [
      { key: "q1", text: "Which teammate do you know the least? What's one thing you could learn about her?" },
      { key: "q2", text: "How do you want a new player to feel on your team?" },
    ],
    steps: [
      { key: "s1", text: "Learn one new thing about a teammate you don't know well." },
      { key: "s2", text: "Ask a different teammate to be your throwing partner." },
    ],
  },
  {
    slug: "light-talk-like-a-leader",
    part: "Lead your team",
    title: "Talk Like a Leader",
    bigIdea: "Leaders listen first, then use their words to lift people up.",
    body: [
      "Good leaders are good listeners. Look at your coach when she's talking. Let teammates finish what they're saying. Ask a question when you don't understand.",
      "When you talk, make it loud, positive and useful. Call the ball on a pop-up. Remind the outfield how many outs there are. Cheer from the dugout. Say things that help, never things that hurt.",
    ],
    lists: [
      {
        title: "Leader talk",
        points: [
          "\"Two outs, play's at first!\"",
          "\"Shake it off, next one's yours.\"",
          "\"Great hustle!\"",
          "\"I've got your back.\"",
          "\"Let's go, we've got this.\"",
        ],
      },
    ],
    questions: [
      { key: "q1", text: "What's something a teammate said to you that made you play better?" },
      { key: "q2", text: "What could you say to a teammate who just struck out?" },
    ],
    steps: [
      { key: "s1", text: "Call out the number of outs to your teammates before every pitch for a whole inning." },
      { key: "s2", text: "Say something encouraging to three teammates at your next practice." },
    ],
  },
  {
    slug: "light-pick-them-up",
    part: "Lead your team",
    title: "Pick Your Teammates Up",
    bigIdea: "Everybody makes errors. Leaders help their teammates bounce back.",
    body: [
      "Softball is a game of failure. Great hitters still make outs most of the time, and every fielder boots a ground ball sometimes. What matters is what happens next.",
      "When a teammate makes an error or strikes out, don't sigh, roll your eyes or look away. Tell her to shake it off and get her ready for the next pitch. When you're the one who messed up, take a deep breath, reset and be ready.",
    ],
    questions: [
      { key: "q1", text: "How do you feel after you make an error? What helps you reset?" },
      { key: "q2", text: "What will you say or do the next time a teammate makes a mistake?" },
    ],
    steps: [
      { key: "s1", text: "After a teammate's error, say something that helps her reset." },
      { key: "s2", text: "Pick a reset move for yourself, like a deep breath or a tap of your glove, and use it after your next mistake." },
    ],
  },
  {
    slug: "light-protect-the-team",
    part: "Lead your team",
    title: "Protect Your Team",
    bigIdea: "A team is only as strong as how its players treat each other when the coach isn't looking.",
    body: [
      "Your team has rules and standards: be on time, work hard, respect everyone. Leaders follow them all the time, not just when a coach is watching.",
      "If teammates are being mean, leaving someone out or talking trash about the team, a leader speaks up. It takes courage, so keep it simple: \"Hey, that's not who we are.\" Then bring in the person who was left out. If it's serious, tell your coach or a parent.",
    ],
    questions: [
      { key: "q1", text: "What's one rule or standard your team has? Why does it matter?" },
      { key: "q2", text: "What would you do if you saw a teammate being left out?" },
    ],
    steps: [
      { key: "s1", text: "Bring a teammate who's by herself into a drill, a game of catch or a conversation." },
      { key: "s2", text: "Follow every team rule this week, even when no coach is around." },
    ],
  },
]);

/** The Leadership Light plan: why, one habit, one goal with two steps, two check-ins. */
export const LIGHT_PLAN_SHOW = { habits: 1, goals: 1, checkIns: 2, reflection: false };
export const LIGHT_COMMITMENT = [
  "I choose to lead.",
  "I'll bring my best effort and my best attitude.",
  "I'll show my team the way with my actions.",
  "I'll be a great teammate to everyone.",
  "I'll pick my teammates up when they make mistakes.",
];

export const ALL_LESSONS: Lesson[] = [...LESSONS, ...BONUS, ...LIGHT_LESSONS];

/** The lessons a program's course is made of (the sign-off needs all of them). */
export const programLessons = (p: Program) => (p === "light" ? LIGHT_LESSONS : LESSONS);
/** The program a lesson belongs to (Extra Reps are part of the Full program). */
export const lessonProgram = (l: Lesson): Program => (l.kind === "light" ? "light" : "full");

export function findLesson(slug: string) {
  return ALL_LESSONS.find((l) => l.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// The lesson tools
// ---------------------------------------------------------------------------

/** Every Player Leads: the seven kinds of leaders. She names a teammate for each. */
export const LEADER_ROLES: LeaderRole[] = [
  { key: "role-captain", title: "The Captain", does: "Sets the tone, lives the team's values every day, keeps everyone pointed at the big goal, and connects players and coaches.", brings: "Example, inspiration, the long view." },
  { key: "role-energy", title: "The Energy Booster", does: "Lifts the dugout through a grind of a practice or a losing streak.", brings: "Positivity, enthusiasm, reading the room." },
  { key: "role-tactician", title: "The Tactician", does: "Knows the game cold, helps run the plan and spots the adjustment mid-game.", brings: "Softball IQ, strategy, smart calls under pressure." },
  { key: "role-standard", title: "The Standard-Bearer", does: "Holds the line on team standards, speaks up when effort slips, and backs it up by being early and going hard.", brings: "Integrity, discipline, accountability." },
  { key: "role-glue", title: "The Glue", does: "Makes sure everyone feels part of the team and settles small conflicts before they grow.", brings: "Empathy, connection, communication." },
  { key: "role-mentor", title: "The Mentor", does: "An experienced player who guides younger ones through pressure and the learning curve.", brings: "Experience, teaching, patience." },
  { key: "role-toughness", title: "The Toughness Leader", does: "Stays calm when you're down and keeps everyone fighting to the last out.", brings: "Grit, composure, never quitting." },
];

/** All In: the five levels (1 to 5), and where she rates herself and her team. */
export const ENGAGEMENT_LEVELS = ["Gone", "Checked out", "Along for the ride", "Locked in", "All in"] as const;
export const ENGAGEMENT_ASK: RubricArea[] = [
  { key: "e-me", title: "Where I am now", looks: "Be honest. Nobody's grading this." },
  { key: "e-goal", title: "Where I need to be", looks: "The level your team needs from you." },
  { key: "e-team", title: "Where my team is", looks: "Most of the team, most of the time." },
];

/** Habits of Great Leaders: she marks each a strength or something she's working on. */
export const HABIT_GROUPS = ["Lead yourself", "Compete", "Connect", "Grow"] as const;
export const HABITS: HabitItem[] = [
  { key: "h-little", group: "Lead yourself", text: "Does the little things right." },
  { key: "h-real", group: "Lead yourself", text: "Is the real her, every day." },
  { key: "h-time", group: "Lead yourself", text: "On time, every time. Respects everyone's time." },
  { key: "h-plan", group: "Lead yourself", text: "Makes a plan and sticks to it." },
  { key: "h-priorities", group: "Lead yourself", text: "Knows her priorities and stays organized." },
  { key: "h-balance", group: "Lead yourself", text: "Balances softball, school and life." },
  { key: "h-standards", group: "Lead yourself", text: "Holds herself to a high standard first." },
  { key: "h-integrity", group: "Lead yourself", text: "Does the right thing on the field, in school and online." },
  { key: "h-self-know", group: "Lead yourself", text: "Knows her strengths, her weaknesses and her values." },
  { key: "h-reflect", group: "Lead yourself", text: "Takes time to look back and learn." },
  { key: "h-passion", group: "Compete", text: "Plays with passion." },
  { key: "h-all-out", group: "Compete", text: "Competes all out, every rep." },
  { key: "h-not-average", group: "Compete", text: "Won't settle for average." },
  { key: "h-process", group: "Compete", text: "Trusts the process, not just the scoreboard." },
  { key: "h-poise", group: "Compete", text: "Keeps her poise under pressure." },
  { key: "h-bounce", group: "Compete", text: "Bounces back from mistakes and setbacks." },
  { key: "h-failure", group: "Compete", text: "Treats failure as a lesson." },
  { key: "h-own", group: "Compete", text: "Owns her results. No excuses, no blaming." },
  { key: "h-adapt", group: "Compete", text: "Adapts when things change." },
  { key: "h-risks", group: "Compete", text: "Takes smart risks." },
  { key: "h-listen", group: "Connect", text: "Really listens." },
  { key: "h-understand", group: "Connect", text: "Tries to understand before she judges." },
  { key: "h-empathy", group: "Connect", text: "Feels for her teammates and shows it." },
  { key: "h-serve", group: "Connect", text: "Serves her team first." },
  { key: "h-trust", group: "Connect", text: "Earns trust, and builds it between teammates." },
  { key: "h-friend", group: "Connect", text: "Is someone teammates can count on." },
  { key: "h-include", group: "Connect", text: "Brings everyone in, from every background." },
  { key: "h-celebrate", group: "Connect", text: "Celebrates her teammates' wins." },
  { key: "h-clear", group: "Connect", text: "Talks clearly and keeps everyone on the same page." },
  { key: "h-hard-talk", group: "Connect", text: "Has the hard conversation instead of avoiding it." },
  { key: "h-confidence", group: "Connect", text: "Builds up her teammates' confidence." },
  { key: "h-jobs", group: "Connect", text: "Gives teammates real jobs and lets them shine." },
  { key: "h-conflict", group: "Connect", text: "Settles conflicts early and fairly." },
  { key: "h-learn", group: "Grow", text: "Hungry to learn." },
  { key: "h-feedback", group: "Grow", text: "Asks for feedback and uses it." },
  { key: "h-mentors", group: "Grow", text: "Learns from coaches and mentors." },
  { key: "h-strengths", group: "Grow", text: "Builds on her strengths." },
  { key: "h-helps-grow", group: "Grow", text: "Helps teammates get better." },
  { key: "h-humble", group: "Grow", text: "Stays humble. It's a team game." },
  { key: "h-curious", group: "Grow", text: "Asks good questions and gets the team curious." },
  { key: "h-challenges", group: "Grow", text: "Goes looking for new challenges." },
  { key: "h-solve", group: "Grow", text: "Finds creative ways to solve problems." },
  { key: "h-vision", group: "Grow", text: "Knows where the team is going and keeps everyone pointed there." },
  { key: "h-inspire", group: "Grow", text: "Inspires with her words and her actions." },
];

/** Accountability Starters: lines to open the conversation, by what they're for. */
export const STARTER_GROUPS: { title: string; lines: string[] }[] = [
  {
    title: "Name the standard",
    lines: ["That's not how we do things here.", "That's not who we are as a program.", "Here's our standard, and it's not up for debate.", "That's not okay on this team."],
  },
  {
    title: "Raise the bar",
    lines: ["That's not us. We're better than that.", "I need more from you today.", "We need everybody's best right now, and that includes you.", "I know it's uncomfortable. Push through it with me."],
  },
  { title: "Show what it costs", lines: ["When you do that, it hurts all of us. Nobody's bigger than the team.", "We win together and we lose together."] },
  { title: "Own the role", lines: ["Your job matters to this team. Own it."] },
  {
    title: "Hold each other up",
    lines: ["Let's push each other. I'll hold you to it, and you hold me to it.", "Before I point at anybody, I check myself first.", "Same standard on the field, in school and online."],
  },
  { title: "Reset", lines: ["Next play. Let it go and lock back in."] },
];

/** What Would You Do?: situations to talk through, each with a leader's move to compare. */
export const SCENARIO_GROUPS = ["Effort and standards", "Attitude and energy", "Conflict and drama", "Teammates who need you", "Game day", "Off the field"] as const;
export const SCENARIOS: Scenario[] = [
  { key: "sc-late", group: "Effort and standards", title: "Late and half-speed", situation: "A teammate keeps showing up late and going half-speed in drills.", move: "Talk to her privately, not in front of everyone. Ask what's going on first. Then be clear: we need you on time and all in, and I'll help you get there." },
  { key: "sc-coasting", group: "Effort and standards", title: "Coasting", situation: "During conditioning, one teammate coasts while everyone else is dying.", move: "Pull up next to her and finish the next one together. Correct without shaming. Save the real talk for after, one on one." },
  { key: "sc-half-jog", group: "Effort and standards", title: "Half the team jogs", situation: "Half the team is going all out in conditioning. The other half is jogging it in.", move: "Get louder, not angrier. Bring the group together, name the standard, and go first. Energy spreads both ways, so make it spread your way." },
  { key: "sc-best-friend", group: "Effort and standards", title: "My best friend", situation: "Your best friend is the worst on the team at following the standards.", move: "Real friends hold each other to the standard. Tell her privately, as her friend: you're better than this, and the team needs you." },
  { key: "sc-school", group: "Effort and standards", title: "School rules", situation: "Some teammates are skipping class, breaking school rules or being rude to teachers.", move: "The standard doesn't stop at the field. Say it plainly: how we act at school is how people see our team. If it keeps happening, it goes to your coach." },
  { key: "sc-weekend", group: "Effort and standards", title: "Weekend choices", situation: "A teammate's choices on weekends are getting around school, and it's starting to hurt the team's culture.", move: "Talk to her early, privately and with care. Bad choices off the field are a big fire, so bring your coach in." },
  { key: "sc-flat", group: "Attitude and energy", title: "Flat practice", situation: "Practice is dead: no talking, no energy, everyone going through the motions.", move: "Be the thermostat. Start the chatter, make the first big play of energy, challenge a teammate to a race. Energy is contagious." },
  { key: "sc-griping", group: "Attitude and energy", title: "Losing-streak griping", situation: "You've lost four straight. Players are griping about the team and the coaches.", move: "Don't agree and don't join in. Steer the talk to what you control: effort, attitude, the next practice. Ask what each of you can fix." },
  { key: "sc-big-talk", group: "Attitude and energy", title: "The big talk", situation: "Morale is low after a losing streak, and your coach asks you to talk to the team.", move: "Keep it short and real. Name what's hard, remind everyone what you're playing for, and give one thing to do today. Then go do it first." },
  { key: "sc-eye-roll", group: "Attitude and energy", title: "Eye rolls", situation: "After a loss, your coach gives a tough talk, and you see teammates rolling their eyes.", move: "Back the coach's message in the huddle and after. Later, tell those teammates privately that the eye rolls hurt the team, even if the talk stung." },
  { key: "sc-sulk", group: "Attitude and energy", title: "The sulk", situation: "After an error, a teammate slams her glove, sulks and checks out for the next two innings.", move: "Get to her fast: a quick word, a tap on the helmet, next play. Help her reset now and talk about the reaction after the game." },
  { key: "sc-down-late", group: "Attitude and energy", title: "Down late", situation: "You're down a run in the last inning of a close game. The dugout is tense and quiet.", move: "Calm body language, loud belief. Get on the fence, pick up the next hitter, and remind everyone: one pitch, one at-bat, one play." },
  { key: "sc-argument", group: "Conflict and drama", title: "Blow-up at practice", situation: "Two teammates start arguing loudly in the middle of practice.", move: "Don't take sides. Stop it now, get everyone back to work, and settle it later with the two of them, away from the team." },
  { key: "sc-playing-time", group: "Conflict and drama", title: "Playing time", situation: "Two teammates are fighting about who should be playing more. It's spilling into practice and the dugout.", move: "Playing time is the coach's call, so don't referee it. Remind both that the team needs them either way, and point them to the coach for that conversation." },
  { key: "sc-position", group: "Conflict and drama", title: "Same spot", situation: "You and a close friend are competing for the same position, and it's getting tense.", move: "Compete hard and cheer harder. Tell her straight up: may the best player win, and I've got your back either way." },
  { key: "sc-gossip", group: "Conflict and drama", title: "Gossip and cliques", situation: "Small groups are gossiping about teammates, and the team is splitting into groups that don't talk.", move: "Shut it down when you hear it: we don't talk about teammates. Then mix it up: sit with a different group, pair across cliques in drills." },
  { key: "sc-old-young", group: "Conflict and drama", title: "Old and young", situation: "Older and younger players don't mix. The upperclassmen stick together and the young ones feel like outsiders.", move: "Cross the line yourself. Learn the younger players' names, include them in warmups, invite them in. It only takes one leader to start." },
  { key: "sc-umpire", group: "Conflict and drama", title: "The umpire", situation: "A bad call, and teammates start yelling at the umpire.", move: "Get them back on the game. Arguing calls is the coach's job. Ours is the next pitch. Sportsmanship includes the umpires." },
  { key: "sc-benched", group: "Teammates who need you", title: "Coach doesn't like me", situation: "A teammate tells you she's on the bench because the coach doesn't like her.", move: "Listen first, but don't agree. Steer her to what she controls: her work, her attitude, and asking the coach what she needs to do to earn more time." },
  { key: "sc-personal", group: "Teammates who need you", title: "Something's wrong", situation: "A teammate is clearly distracted by something going on outside softball.", move: "Show you care without prying. Let her know you're there if she wants to talk. If it sounds serious, tell a coach or another adult you trust." },
  { key: "sc-slump", group: "Teammates who need you", title: "The slump", situation: "A teammate is 0-for-her-last-15, and you can see it eating at her. She's going quiet and pulling away.", move: "Stay close, not on top of her. Remind her what she does well, celebrate her hard-hit outs, and keep her laughing." },
  { key: "sc-injury", group: "Teammates who need you", title: "Sidelined", situation: "A starter is out for six weeks with an injury. She's stopped coming around and feels left out.", move: "Keep her in the team: save her a spot in the dugout, give her a job, text her after games. Let her know the team still needs her." },
  { key: "sc-new", group: "Teammates who need you", title: "The new kids", situation: "New and younger players are quiet and unsure of their role, and one of them has zero confidence.", move: "Mentor one. Show her the ropes, tell her what she's doing well, and give her a small job that makes her part of it." },
  { key: "sc-yelled", group: "Teammates who need you", title: "Called out", situation: "A teammate gets yelled at by the coach in front of everyone at practice.", move: "Back the coach's message, then pick her up after practice: that was hard, you're better than that rep, let's go get it tomorrow." },
  { key: "sc-role-player", group: "Game day", title: "The role player", situation: "A teammate who rarely plays comes in and makes a huge play.", move: "Make it the moment of the day. Be the first one out of the dugout, and tell the whole team about it after the game." },
  { key: "sc-trash-talk", group: "Game day", title: "Trash talk", situation: "Before playing a weak opponent, teammates are trash-talking them.", move: "Shut it down. We respect every opponent, and we play to our standard no matter who's across the field." },
  { key: "sc-bragging", group: "Game day", title: "After the big win", situation: "After a huge win, teammates are bragging and practice gets sloppy.", move: "Celebrate, then reset. Stay humble: the next game doesn't care about the last one." },
  { key: "sc-stats", group: "Game day", title: "Me over we", situation: "Your team just lost, and a teammate is celebrating her own stats.", move: "Talk to her one on one. Her numbers matter when they help the team win. We celebrate wins together and own losses together." },
  { key: "sc-spotlight", group: "Game day", title: "The spotlight", situation: "Your team is ranked, people are talking, and the pressure is starting to show.", move: "Shrink the game: one pitch, one inning, one game at a time. Keep doing what got you here and tune out the noise." },
  { key: "sc-post", group: "Off the field", title: "The post", situation: "A teammate posts something negative about the team online.", move: "Talk to her privately and ask her to take it down. Our standards go online too. If it's serious, bring in the coach." },
  { key: "sc-bonding", group: "Off the field", title: "Team bonding", situation: "Your coach asks the leaders to plan a team-bonding activity.", move: "Pick something that mixes everyone up: different grades, different friend groups. Build the Bond has ideas." },
  { key: "sc-pass-it-on", group: "Off the field", title: "Passing it on", situation: "It's your last season, and your coach asks you to get the next leaders ready.", move: "Start early. Pick the next leaders, show them what you do, give them real jobs before you leave, and tell them why it matters." },
];

/** Rate Your Leadership: she and her coach rate each area 1-5. */
export const RUBRIC_GROUPS = ["Choosing to lead", "Words and actions", "Relationships, accountability and inspiration"] as const;
export const RUBRIC: RubricArea[] = [
  { key: "r-mindset", group: "Choosing to lead", title: "Mindset", looks: "A growth mindset everywhere, and she spreads positive energy." },
  { key: "r-responsibility", group: "Choosing to lead", title: "Responsibility", looks: "Owns the team's results, makes the tough calls, will stand alone for what's right." },
  { key: "r-positive", group: "Words and actions", title: "Positive words", looks: "Positive, even when it's tough." },
  { key: "r-clear", group: "Words and actions", title: "Clear words", looks: "Always clear and to the point." },
  { key: "r-honest", group: "Words and actions", title: "Honest words", looks: "Honest and open, even when it's hard." },
  { key: "r-work", group: "Words and actions", title: "Work ethic", looks: "Her work is the example everyone follows." },
  { key: "r-choices", group: "Words and actions", title: "Choices", looks: "Thinks before she acts and makes responsible choices." },
  { key: "r-resilience", group: "Words and actions", title: "Resilience", looks: "Mentally tough and in control, even when it all goes wrong." },
  { key: "r-connect", group: "Relationships, accountability and inspiration", title: "Connect", looks: "Builds real connections with every teammate." },
  { key: "r-celebrate", group: "Relationships, accountability and inspiration", title: "Celebrate", looks: "Genuinely happy for every teammate's success." },
  { key: "r-energy", group: "Relationships, accountability and inspiration", title: "Energy-giving plays", looks: "Always first with the high five, the hustle and the encouragement." },
  { key: "r-accountability", group: "Relationships, accountability and inspiration", title: "Accountability", looks: "Speaks up when it helps the team and the teammate." },
  { key: "r-inspiration", group: "Relationships, accountability and inspiration", title: "Inspiration", looks: "Pushes teammates toward their best, on and off the field." },
];
export const RUBRIC_LEVELS = ["Not yet", "Rarely", "Sometimes", "Usually", "Always"] as const;
export const RUBRIC_MAX = RUBRIC.length * RUBRIC_LEVELS.length;

/** Ratings out of the rubric's total (missing areas count 0). */
export function rubricTotal(ratings: Record<string, string>) {
  const rated = RUBRIC.filter((r) => ratings[r.key]);
  return { total: rated.reduce((sum, r) => sum + Number(ratings[r.key]), 0), rated: rated.length };
}

/** For coaches, on the guide's first page: what usually gets in the way of player leadership. */
export const COACH_NOTES = [
  "Most players have never been taught how to lead.",
  "Ego and me-first play.",
  "Communication breaks down.",
  "Cliques.",
  "Players pushing back on the coach.",
  "Leaders who don't model it every day.",
  "Not enough accountability.",
  "A few players dominate while others hang back.",
  "Personal goals pulling against team goals.",
  "Players who don't read their own emotions, or other people's.",
];

// ---------------------------------------------------------------------------
// My Leadership Plan
// ---------------------------------------------------------------------------

export type LeadershipPlan = {
  why?: string;
  habits?: string[];
  goals?: { goal: string; steps: string[] }[];
  checkIns?: string[];
  reflection?: string;
};

export const PLAN_LIMITS = { text: 1000, habits: 3, goals: 2, steps: 2, checkIns: 3 };

export const COMMITMENT = [
  "I choose to lead this season.",
  "I'll lead by example with my words and my actions.",
  "I'll connect with every teammate and celebrate every role.",
  "I'll hold the standard for myself first, and for my team.",
  "I'll protect our culture, especially when no one is watching.",
  "I'll work on my plan, my habits and my goals until they're who I am.",
];

/** Cleans up a plan before it's saved: trimmed text, the right number of entries, valid dates. */
export function cleanPlan(raw: LeadershipPlan): LeadershipPlan {
  const text = (v: unknown) => (typeof v === "string" ? v.replace(/\s+\n/g, "\n").trim().slice(0, PLAN_LIMITS.text) : "");
  const habits = Array.from({ length: PLAN_LIMITS.habits }, (_, i) => text(raw.habits?.[i]));
  const goals = Array.from({ length: PLAN_LIMITS.goals }, (_, i) => ({
    goal: text(raw.goals?.[i]?.goal),
    steps: Array.from({ length: PLAN_LIMITS.steps }, (_, k) => text(raw.goals?.[i]?.steps?.[k])),
  }));
  const checkIns = Array.from({ length: PLAN_LIMITS.checkIns }, (_, i) => {
    const d = raw.checkIns?.[i];
    return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
  });
  return { why: text(raw.why), habits, goals, checkIns, reflection: text(raw.reflection) };
}

/** Her plan's check-in dates become one-day reminders in her TWIS (player_activities.source). */
export const CHECKIN_SOURCE = "leadership-checkin";
export const CHECKIN_TITLE = "Leadership check-in with your coach";
export const CHECKIN_DETAILS = "Bring your Leadership Plan: what's working, what's in the way, what you'll change.";

/** The TWIS activity for one check-in date: that day only. */
export function checkInActivity(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7; // ISO: 1 = Monday ... 7 = Sunday
  return { title: CHECKIN_TITLE, details: CHECKIN_DETAILS, days: [weekday], starts_on: date, ends_on: date, source: CHECKIN_SOURCE };
}

/** What to change so the reminders match the plan: dates to add, reminders to remove (kept ones keep their check-offs). */
export function checkInChanges(planDates: (string | undefined)[], existing: { id: string; starts_on: string }[]) {
  const wanted = [...new Set(planDates.filter((d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d))))].sort();
  const have = new Set(existing.map((e) => e.starts_on));
  return {
    add: wanted.filter((d) => !have.has(d)),
    remove: existing.filter((e) => !wanted.includes(e.starts_on)).map((e) => e.id),
  };
}

/** A plan is ready to commit to once she's written why she leads, a habit and a goal. */
export function planReady(plan: LeadershipPlan) {
  return Boolean(plan.why?.trim() && plan.habits?.some((h) => h.trim()) && plan.goals?.some((g) => g.goal.trim()));
}

// ---------------------------------------------------------------------------
// The certificate (and the Leader Badge that comes with it)
// ---------------------------------------------------------------------------

export const CERTIFICATE = {
  title: "Certificate of Leadership",
  honor: "Team Leader",
  presented: "This certifies that",
  completed: `has completed the ${GUIDE_TITLE}`,
  detail: `${LESSONS.length} lessons on leading herself, leading others and leading the team, a personal leadership plan, and her coach's sign-off.`,
  creed: "She chose to lead. She owns her words and her actions, lifts every teammate, and guards the culture.",
};
export const CERTIFICATE_LIGHT: typeof CERTIFICATE = {
  title: "Certificate of Leadership",
  honor: "Team Leader",
  presented: "This certifies that",
  completed: `has completed ${LIGHT_TITLE}`,
  detail: `${LIGHT_LESSONS.length} lessons on leading herself and leading her team, a leader plan, and her coach's sign-off.`,
  creed: "She chose to lead. She brings her best, shows the way and lifts every teammate.",
};
/** The certificate's words and the list along its edge, by the program she finished. */
export const certificateFor = (p: Program) =>
  p === "light" ? { text: CERTIFICATE_LIGHT, rungs: LIGHT_KEYS as readonly string[] } : { text: CERTIFICATE, rungs: LADDER as readonly string[] };
export const LEADER_BADGE = "Team Leader";

// ---------------------------------------------------------------------------
// Her work and progress
// ---------------------------------------------------------------------------

/** Her work on one lesson: answers (question keys, tool keys), steps done, finished. */
export type LessonWork = { lesson: string; answers: Record<string, string>; steps: string[]; completedAt: string | null };

/** The list a lesson is numbered in: the Full course, the Extra Reps or Leadership Light. */
export function lessonList(lesson: Lesson) {
  return lesson.kind === "core" ? LESSONS : lesson.kind === "light" ? LIGHT_LESSONS : BONUS;
}

/** Its number among the core lessons, the Extra Reps or the Leadership Light lessons. */
export function lessonNumber(slug: string) {
  const lesson = findLesson(slug);
  if (!lesson) return null;
  return lessonList(lesson).indexOf(lesson) + 1;
}

/** The lesson's place for links: "Lesson 7" or "Extra Rep 3". */
export function lessonLabel(lesson: Lesson) {
  return `${lesson.kind === "bonus" ? "Extra Rep" : "Lesson"} ${lessonNumber(lesson.slug)}`;
}

function progressOf(list: Lesson[], work: LessonWork[]) {
  const finished = (l: Lesson) => work.some((w) => w.lesson === l.slug && w.completedAt);
  return { done: list.filter(finished).length, total: list.length, next: list.find((l) => !finished(l)) ?? null };
}

/** The program's course: the 25 core lessons, or the Leadership Light lessons. */
export function guideProgress(work: LessonWork[], program: Program = "full") {
  return progressOf(programLessons(program), work);
}

export function bonusProgress(work: LessonWork[]) {
  return progressOf(BONUS, work);
}

/** Ready for the coach's sign-off (and the certificate): every lesson of her program done and the plan committed. */
export function courseReady(work: LessonWork[], committedAt: string | null, program: Program = "full") {
  const p = guideProgress(work, program);
  return p.done === p.total && Boolean(committedAt);
}

/** The certificate's program after a sign-off: a Full certificate is never traded down for a Light one. */
export function certificateProgram(signedOff: Program, current: Program | null): Program {
  return current === "full" ? "full" : signedOff;
}

/** The keys she can save answers under in a lesson: its questions, plus its tool's items. */
export function answerKeys(lesson: Lesson): string[] {
  const keys = lesson.questions.map((q) => q.key);
  if (lesson.tool === "habits") keys.push(...HABITS.map((h) => h.key));
  if (lesson.tool === "rubric") keys.push(...RUBRIC.map((r) => r.key));
  if (lesson.tool === "scenarios") keys.push(...SCENARIOS.map((s) => s.key));
  if (lesson.tool === "starters") keys.push("my-starter");
  if (lesson.tool === "roles") keys.push(...LEADER_ROLES.map((r) => r.key));
  if (lesson.tool === "engagement") keys.push(...ENGAGEMENT_ASK.map((e) => e.key));
  return keys;
}

const RATING = (max: number) => ["", ...Array.from({ length: max }, (_, i) => String(i + 1))];

/** What's allowed in an answer: habits are "strength" or "growth", ratings 1-5, everything else text. */
export function cleanAnswer(lesson: Lesson, key: string, value: string): string | null {
  if (!answerKeys(lesson).includes(key)) return null;
  if (lesson.tool === "habits" && HABITS.some((h) => h.key === key)) return ["strength", "growth", ""].includes(value) ? value : null;
  if (lesson.tool === "rubric" && RUBRIC.some((r) => r.key === key)) return RATING(RUBRIC_LEVELS.length).includes(value) ? value : null;
  if (lesson.tool === "engagement" && ENGAGEMENT_ASK.some((e) => e.key === key))
    return RATING(ENGAGEMENT_LEVELS.length).includes(value) ? value : null;
  return value.trim().slice(0, ANSWER_MAX);
}

/** A coach's rating on the rubric: 1-5, or "" to clear it. */
export function validCoachRating(key: string, value: string) {
  return RUBRIC.some((r) => r.key === key) && RATING(RUBRIC_LEVELS.length).includes(value);
}
