// Admin-only Access FAQ (/faq, user 2026-11-08): what a player gets with Standard
// Access and with Advanced Access (G3 Advanced), side by side, plus common
// questions. Admins only, so it may name the hidden rewards. Keep it in step
// with the site when features change. No imports, so it runs in unit tests.

export const TIERS = [
  { key: "standard", label: "Standard Access", note: "Every player whose profile claim a coach approves." },
  { key: "advanced", label: "Advanced Access", note: "G3 Advanced: an admin unlocks it per player today; a paid subscription later." },
] as const;

/** included = a softball; "coach" = included once a coach or admin also says so (picked, confirmed). */
export type Access = "yes" | "no" | "coach";

export type Feature = { name: string; detail: string; standard: Access; advanced: Access; condition?: string };

export const FEATURE_SECTIONS: { title: string; features: Feature[] }[] = [
  {
    title: "Her player menu",
    features: [
      { name: "Player menu dashboard", detail: "Her cafe-menu home: photo, walk-up songs, every menu board.", standard: "yes", advanced: "yes" },
      { name: "From the Dugout", detail: "Team Standards and Team Culture from her coaches.", standard: "yes", advanced: "yes" },
      { name: "This Week in Softball (TWIS)", detail: "Practices, games and her activities for the week, with check-offs.", standard: "yes", advanced: "yes" },
      { name: "Pop Report", detail: "Profile, teams, measurements and her Preferred Hitting Style.", standard: "yes", advanced: "yes" },
      { name: "Movement Preferences", detail: "Her move dial and at-bat focus tip in the Pop Report, set by her coaches.", standard: "no", advanced: "yes" },
      { name: "Goals", detail: "Harada Method chart or SMART goals.", standard: "yes", advanced: "yes" },
      { name: "Mental GP", detail: "Her Mental Game Plan.", standard: "yes", advanced: "yes" },
    ],
  },
  {
    title: "Training and the offseason",
    features: [
      { name: "Performance Training", detail: "Workout, hitting, fielding, pitching and catching routines, with achievements.", standard: "yes", advanced: "yes" },
      { name: "+ Activity", detail: "Log a training session, workout or private lesson in a few taps.", standard: "yes", advanced: "yes" },
      { name: "Offseason Leaderboard", detail: "Team standings by points: sessions, workouts, lessons and unlocks.", standard: "yes", advanced: "yes" },
      { name: "Player of the Week", detail: "Most points that week; a teammate who has not won yet goes first.", standard: "yes", advanced: "yes" },
    ],
  },
  {
    title: "Softball IQ",
    features: [
      { name: "Defense and Baserunning IQ", detail: "Playbook tests, Levels 1-3, with hints and review.", standard: "yes", advanced: "yes" },
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
      { name: "Her book: How to Cook", detail: "How to Compete: It Starts with Good Habits, then six chapters she builds on and completes.", standard: "no", advanced: "yes" },
      { name: "Position chapters", detail: "First one: Pitching: My Best Is Better.", standard: "no", advanced: "coach", condition: "A coach confirms her position on her book page." },
      { name: "Coming chapters", detail: "My Position, Hitting Approach, Mental Toughness (content later).", standard: "no", advanced: "yes" },
      { name: "G3 Leadership Guide", detail: "25 lessons, 22 Extra Reps, My Leadership Plan with check-in reminders.", standard: "no", advanced: "coach", condition: "A coach or admin picks her to train as a leader." },
      { name: "Certificate of Leadership and Leader Badge", detail: "Printable certificate and a badge by her name: seen only by coaches, admins and her.", standard: "no", advanced: "coach", condition: "Every lesson done, plan committed, and the coach signs off." },
    ],
  },
];

export const FAQ: { q: string; a: string[] }[] = [
  {
    q: "What's the difference between Standard and Advanced Access?",
    a: [
      "Standard Access is everything on the site for a player whose profile claim a coach has approved: her menu, TWIS, goals, Softball IQ, the Trophy Room, training and the offseason Leaderboard.",
      "Advanced Access adds G3 Advanced: Movement Preferences in her Pop Report, her How to Cook book, position chapters, and the G3 Leadership Guide for players her coach picks.",
    ],
  },
  {
    q: "How do I give a player Advanced Access?",
    a: [
      "Open her player menu. Admins see an \"Unlock G3 Advanced\" strip under her menu boards. One click unlocks it, and the G3 Advanced board and section appear for her.",
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
