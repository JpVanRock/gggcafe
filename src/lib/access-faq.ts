// Admin-only Access FAQ (/faq, user 2026-11-08): what a player gets with Standard
// Access and with Advanced Access (G3 Advanced), side by side, plus common
// questions. Admins only, so it may name the hidden rewards. Keep it in step
// with the site when features change. No imports, so it runs in unit tests.

export const TIERS = [
  { key: "standard", label: "Standard Access", note: "Every player whose profile claim a coach approves, or whose parent made her login." },
  { key: "advanced", label: "Advanced Access", note: "G3 Advanced: a head coach or admin unlocks it per player today; a paid subscription later." },
] as const;

/** included = a softball; "coach" = included once a coach or admin also says so (picked, confirmed). */
export type Access = "yes" | "no" | "coach";

export type Feature = { name: string; detail: string; standard: Access; advanced: Access; condition?: string };

export const FEATURE_SECTIONS: { title: string; features: Feature[] }[] = [
  {
    title: "Her player menu",
    features: [
      { name: "Player menu dashboard", detail: "Her cafe-menu home: photo, walk-up songs, every menu board.", standard: "yes", advanced: "yes" },
      { name: "From the Dugout", detail: "Team Standards and Team Culture from her coaches, with the season motto.", standard: "yes", advanced: "yes" },
      { name: "Team Hitting Philosophy and Throwing Program", detail: "On her Team page: how her team hits, and her group's throwing program (Outies, Innies or Catchers; pitchers have their own).", standard: "yes", advanced: "yes" },
      { name: "Season goals and Player Spotlights", detail: "The team's goals with progress, and coach-written spotlights with a media-day graphic, on her Team page.", standard: "yes", advanced: "yes" },
      { name: "My commitment and the team pledge", detail: "An \"I will...\" line for each Team Standard, and her signature on the team pledge each season.", standard: "yes", advanced: "yes" },
      { name: "Messages from her mentors", detail: "Alerts at the top of her menu: notes, photos and drills to try, from mentors her parents or head coach approved.", standard: "yes", advanced: "yes" },
      { name: "This Week in Softball (TWIS)", detail: "Practices, games and her activities for the week, with check-offs.", standard: "yes", advanced: "yes" },
      { name: "Practice notes in TWIS", detail: "On practice days: the plan's objective, rule of the day, announcements and a cue her coach wrote just for her (never the coach-only notes).", standard: "yes", advanced: "yes" },
      { name: "Pop Report", detail: "Profile, teams, measurements by season (Fall, Winter Offseason, Spring, Summer) and her Preferred Hitting Style.", standard: "yes", advanced: "yes" },
      { name: "My Zone", detail: "Her pitch, what she handles and her weak spots on the strike zone, and the count plan they give (0, 1, 2 strikes).", standard: "yes", advanced: "yes" },
      { name: "Movement Preferences", detail: "Her move dial and at-bat focus tip in the Pop Report, set by her coaches.", standard: "no", advanced: "yes" },
      { name: "Goals", detail: "The Best Version of You (four questions and the 15 Minutes a Day Personal Challenge), then a Harada Method chart or SMART goals.", standard: "yes", advanced: "yes" },
      { name: "Mental GP", detail: "Her Mental Game Plan: focus words, routines, a reset for tough moments.", standard: "yes", advanced: "yes" },
      { name: "My signals and intensity checks", detail: "Green, yellow and red with a release for each, her zone, and a 1-10 check before games.", standard: "yes", advanced: "yes" },
      { name: "Monthly self-scan", detail: "Ten mental skills rated 1 to 5 once a month, with the trend.", standard: "yes", advanced: "yes" },
      { name: "Guided sessions", detail: "Breathing and imagery, a few minutes each; as a mental routine they show in TWIS and count toward achievements.", standard: "yes", advanced: "yes" },
      { name: "Practice journal", detail: "A purpose before practice, what worked and what to fix after, and a weekly look-back.", standard: "yes", advanced: "yes" },
      { name: "My Journal", detail: "A pill in Mental GP: her notes and voice memos from sessions with her mentors. Hers and her parents'; she can share an entry with that mentor; coaches don't read it.", standard: "yes", advanced: "yes" },
      { name: "Video calls", detail: "Zoom calls a mentor or head coach books with her, held on GGG.Cafe; her parents are told and can join; never recorded. Only where a site admin turned calls on for her team.", standard: "yes", advanced: "yes" },
      { name: "Mental GP lessons", detail: "Eight short lessons for game moments (between pitches, big at-bats, nerves, errors, slumps, bad calls, her role, game day); her answer finishes each one, four of them build her Mental Game Plan, and an Up next pick follows her self-scan. With G3 Advanced, each links to the chapters that go deeper.", standard: "yes", advanced: "yes" },
    ],
  },
  {
    title: "Training and the offseason",
    features: [
      { name: "Performance Training", detail: "Workout, hitting, fielding, pitching and catching routines, with achievements.", standard: "yes", advanced: "yes" },
      { name: "+ Activity", detail: "Log a training session, workout or private lesson in a few taps.", standard: "yes", advanced: "yes" },
      { name: "Offseason Leaderboard", detail: "Team standings by points: sessions, workouts, lessons and unlocks, plus the top five in BP production (20+ graded swings).", standard: "yes", advanced: "yes" },
      { name: "Season stats card", detail: "Her hitting, pitching and fielding from box scores on her Pop Report, quality at-bat % and production, BP production; tap any stat to see how it's figured (ERA on 7 innings).", standard: "yes", advanced: "yes" },
      { name: "Player of the Week", detail: "Most points that week; a teammate who has not won yet goes first.", standard: "yes", advanced: "yes" },
      { name: "Training phase in TWIS", detail: "Her team's roadmap phase and week (Build · Week 3 of 9) with its focus.", standard: "yes", advanced: "yes" },
      { name: "Team routines", detail: "Routines her coaches push to the team; she checks them off in TWIS but can't change them.", standard: "yes", advanced: "yes" },
      { name: "Scripted bullpens", detail: "Pitchers throw their coaches' scripts and tap hit or miss; command % by pitch type.", standard: "yes", advanced: "yes" },
      { name: "Pitcher's game plans", detail: "Before each game her plan (first pitch, out pitch, reset), after it a look-back.", standard: "yes", advanced: "yes" },
      { name: "Athletic testing results", detail: "Her latest result in each test, rated Building to Elite for her age group, with a score. Only she and her coaches see them.", standard: "yes", advanced: "yes" },
      { name: "Offseason squads", detail: "Her squad and every squad's points on the Leaderboard, after the head coach runs the draft.", standard: "yes", advanced: "yes" },
    ],
  },
  {
    title: "Softball IQ",
    features: [
      { name: "Defense and Baserunning IQ", detail: "Playbook tests, Levels 1-3, with hints and review.", standard: "yes", advanced: "yes" },
      { name: "Offense IQ", detail: "Counts, situational hitting, the short game and slapping: Levels 1-3, each passed level unlocks the next, MVP badges.", standard: "yes", advanced: "yes" },
      { name: "Battery IQ", detail: "Pitch calling for pitchers and catchers (anyone can take it): Levels 1-3, MVP badges.", standard: "yes", advanced: "yes" },
      { name: "Team Playbook", detail: "Her team's call sheet as flashcards and the short quizzes her coaches write (graded right away; her first try is her score). Only her team's calls; never how signs are given.", standard: "yes", advanced: "yes" },
      { name: "Position IQ", detail: "21 questions per position; 80% earns that Golden Glove.", standard: "yes", advanced: "yes" },
      { name: "Extra Credit Library", detail: "Every shelf in one run; 80% earns the GGG Champions Trophy.", standard: "yes", advanced: "yes" },
      { name: "How to Keep the Book", detail: "Six-chapter scorekeeping course; each chapter earns Manager of the Year.", standard: "yes", advanced: "yes" },
      { name: "Keep the Book games", detail: "Ten games to score after the course, with two hidden trophies.", standard: "yes", advanced: "yes" },
    ],
  },
  {
    title: "Trophy Room",
    features: [
      { name: "Championship rings and Stolen Base plaques", detail: "One per Defense and Baserunning IQ level passed.", standard: "yes", advanced: "yes" },
      { name: "Golden Gloves, MVP badges, Manager of the Year", detail: "Earned in Softball IQ.", standard: "yes", advanced: "yes" },
      { name: "Hidden trophies", detail: "GGG World Series Trophy and GGG Dynasty Trophy: never shown until earned.", standard: "yes", advanced: "yes" },
      { name: "Training achievements", detail: "Earned from routine consistency.", standard: "yes", advanced: "yes" },
    ],
  },
  {
    title: "G3 Advanced",
    features: [
      { name: "Team Yearbook", detail: "The season in photos from coaches and parents, tagged by player: yearbook spreads or thumbnails.", standard: "no", advanced: "yes" },
      { name: "Her book: How to Cook", detail: "How to Compete: It Starts with Good Habits, then the chapters she builds on and completes.", standard: "no", advanced: "yes" },
      { name: "Hitting Approach chapter", detail: "A course (her routine, count plan, two strikes, the short game, reading the pitcher, a slump reset), her count plan from My Zone, then the habits.", standard: "no", advanced: "yes" },
      { name: "Mental Toughness chapter", detail: "A step-through course (confidence, next pitch, breathing, her zone, signals, imagery, her reset), then the habits.", standard: "no", advanced: "yes" },
      { name: "Position chapters", detail: "First one: Pitching: My Best Is Better.", standard: "no", advanced: "coach", condition: "A coach confirms her position on her book page." },
      { name: "Coming chapters", detail: "My Position (content later).", standard: "no", advanced: "yes" },
      { name: "G3 Leadership Guide (Full Leadership Program)", detail: "25 lessons, 25 Extra Reps (Know your why included), My Leadership Plan with check-in reminders.", standard: "no", advanced: "coach", condition: "A coach or admin picks her to train as a leader and chooses the Full program." },
      { name: "Leadership Light", detail: "8 short lessons for players 11 and under, a short leader plan with check-in reminders.", standard: "no", advanced: "coach", condition: "A coach or admin picks her and chooses Leadership Light. They can switch her to the Full program later; her work is kept." },
      { name: "Certificate of Leadership and Leader Badge", detail: "Printable certificate and a badge by her name: seen only by coaches, admins and her.", standard: "no", advanced: "coach", condition: "Every lesson of her program done, plan committed, and the coach signs off. Finishing Full after Light upgrades the certificate." },
    ],
  },
];

export const FAQ: { q: string; a: string[] }[] = [
  {
    q: "What's the difference between Standard and Advanced Access?",
    a: [
      "Standard Access is everything on the site for a player whose profile claim a coach has approved (or whose parent made her login): her menu, TWIS, goals, Softball IQ, the Trophy Room, training and the offseason Leaderboard.",
      "Advanced Access adds G3 Advanced: Movement Preferences in her Pop Report, her How to Cook book, position chapters, and the G3 Leadership Guide for players her coach picks.",
    ],
  },
  {
    q: "How do I give a player Advanced Access?",
    a: [
      "Coaches Dugout → Roster. Head coaches and admins see a G3 Advanced column; click Unlock next to her name, and the G3 Advanced board and section appear for her. Until then her pages say nothing about it, so she doesn't know it exists.",
      "Later, a paid subscription will unlock it the same way.",
    ],
  },
  {
    q: "What happens if I turn G3 Advanced off?",
    a: [
      "It disappears for her right away: the G3 Advanced board, section and pages, and Movement Preferences in her Pop Report. Everything she wrote, and every movement version her coaches saved, is kept and comes back if you unlock it again.",
    ],
  },
  {
    q: "Does a player know G3 Advanced exists before she has it?",
    a: ["No. Until it's unlocked there's no board, no section-menu entry, and its pages don't exist for her."],
  },
  {
    q: "Who gets the Pitching chapter?",
    a: ["Players with Advanced Access whom a coach confirms as a pitcher, on her book page under \"Coaches · position chapters\". Nobody else sees it, counts it or can open it."],
  },
  {
    q: "Who gets the G3 Leadership Guide?",
    a: [
      "Players with Advanced Access whom a coach or admin picks: \"Train {name} as a leader\" on her book page.",
      "She earns the Certificate of Leadership and the Leader Badge when every core lesson is complete, her plan is committed, and her coach signs off on her plan page.",
    ],
  },
  {
    q: "Who can see the Leader Badge?",
    a: ["Only coaches, admins and the player herself, next to her name on her menu and on the Dugout roster. View-only staff, teammates and parents can't see it."],
  },
  {
    q: "How do Leaderboard points work?",
    a: [
      "3 points per site unlock, 3 per training session, 5 per workout, 7 per private lesson. Only activity inside the team's offseason dates counts.",
      "Coaches set those dates in Coaches Dugout → Calendar.",
    ],
  },
  {
    q: "How is Player of the Week picked?",
    a: [
      "Most points Monday to Sunday, with at least 10, named the Tuesday after. Nobody wins twice until every teammate has won once, and never twice within six weeks.",
      "Coaches and admins get a notification (the bell in the top menu) for each new Player of the Week.",
    ],
  },
  {
    q: "Who can see and add to the Team Yearbook?",
    a: [
      "Players with G3 Advanced see their team's yearbook (the Yearbook pill on their menu). Parents see it as a main menu item, and can add photos, once their daughter on that team has G3 Advanced.",
      "Coaches and admins always see it (Coaches Dugout → Culture, the Yearbook pill in \"What players see\"), add photos, and can edit or remove any of them. Whoever adds a photo can tag players, so everyone can search by name.",
    ],
  },
  {
    q: "What can a mentor see and do?",
    a: [
      "Mentors (a mentor, a pitching or hitting coach…) sign up, pick \"Mentor\" and enter the team code, then ask to work with one player (by name) or the whole team. A player's approved parents approve a mentor for her on the family page; a head coach approves one for the whole team in Coaches Dugout → Mentors. Admins can approve either.",
      "A mentor sees only the players she's approved for (the whole team's current roster, or that one player): their Goals, Pop Report (Movement Preferences only with G3 Advanced) and Mental GP, read-only. She can message them with a photo or a drill (from the Drill Library, or one she adds to it), and add training to their This Week in Softball for one player or a group, once or every week.",
      "Messages to a player are private to the player, her parents and the admins unless the mentor shares one with the coaches. Head coaches can remove a shared message; admins any message.",
      "Mentors keep notes with the coaches: discussion summaries, what they're working on and what's working, about a player or the whole team. Coaches read them and head coaches reply. The player's parents read the ones about her; players don't see them.",
      "Mentors aren't staff and see nothing else.",
    ],
  },
  {
    q: "What do teammates see of each other?",
    a: ["On the Leaderboard only: names, jersey numbers and points. Never each other's notes, goals, answers or logs."],
  },
  {
    q: "What do parents see?",
    a: ["Parents with an approved request see their team's budget totals only (no other families' names). They can't open player menus."],
  },
  {
    q: "What can view-only staff do?",
    a: ["Read the site, including player menus and G3 work. They can't change anything, unlock access, see the Leader Badge or get notifications."],
  },
];
