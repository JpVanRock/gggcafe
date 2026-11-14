// The five account types (user, 2026-11-08): how each one signs up, its home
// page, and what it can use, side by side. Drawn by the admin-only FAQ at
// /faq/accounts; the sign-up form uses SIGNUP_TYPES. Keep it in step with the
// site (src/lib/roles.ts, the 20261108210100_account_types migration) whenever
// a feature or its access changes. No imports, so it runs in unit tests.

export const SIGNUP_TYPES = ["head-coach", "assistant-coach", "player", "parent", "mentor"] as const;
export type SignupType = (typeof SIGNUP_TYPES)[number];
/** The account types that sign up with their team's code (teams.team_code). */
export const CODE_TYPES: readonly SignupType[] = ["player", "parent", "assistant-coach", "mentor"];

export const SIGNUP_LABEL: Record<SignupType, string> = {
  "head-coach": "Head Coach",
  "assistant-coach": "Assistant Coach",
  player: "Player",
  parent: "Parent",
  mentor: "Mentor",
};

export type AccountType = {
  key: SignupType;
  label: string;
  /** how the account is created and who approves it */
  signup: string;
  /** where it lands after signing in */
  home: string;
};

export const ACCOUNT_TYPES: AccountType[] = [
  {
    key: "head-coach",
    label: "Head Coach",
    signup: "Signs up with an email and confirms it; an admin approves. Registers the team and builds the official roster. A coach who is also a parent claims their daughter from the dashboard and switches between Coach and Parent pages with one login.",
    home: "Coaches dashboard: approvals, check-ins, every Dugout tab",
  },
  {
    key: "assistant-coach",
    label: "Assistant Coach",
    signup: "Signs up with an email and the team code from the head coach, and confirms the email; a head coach of that team (or an admin) approves.",
    home: "Assistant dashboard: this week, practice plans, their Dugout tabs",
  },
  {
    key: "player",
    label: "Player",
    signup: "Signs up with an email and the team code, then claims her spot on the roster (a coach approves), or her parent creates a username login for her. Under 13: her parent's verified consent comes first.",
    home: "Her player menu",
  },
  {
    key: "parent",
    label: "Parent",
    signup: "Signs up with an email, the team code and the daughter's name; a head coach matches the parent to her on the roster.",
    home: "Family page",
  },
  {
    key: "mentor",
    label: "Mentor",
    signup: "Mentors and skill coaches sign up with the team code and confirm their email; a player's parents approve them for her, or the head coach for the whole team.",
    home: "Mentor page: the team's roster or her approved players",
  },
];

/**
 * yes  = a softball (full use)
 * part = a softball tagged PART (some of it; `condition` says which part)
 * own  = a softball tagged OWN (only her own, or their own players/plans)
 * view = a softball tagged VIEW (read only)
 * no   = an empty outline
 */
export type Level = "yes" | "part" | "own" | "view" | "no";
export const LEVELS: Level[] = ["yes", "part", "own", "view", "no"];

export type Row = { name: string; detail: string; access: Record<SignupType, Level>; condition?: string };

const row = (
  name: string,
  detail: string,
  [head, assistant, player, parent, mentor]: [Level, Level, Level, Level, Level],
  condition?: string,
): Row => ({
  name,
  detail,
  access: { "head-coach": head, "assistant-coach": assistant, player, parent, mentor },
  ...(condition ? { condition } : {}),
});

export const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Home page",
    rows: [
      row("Coaches dashboard", "Approvals waiting, Leadership check-ins, team and player counts, the Coaches Dugout.", ["yes", "part", "no", "no", "no"],
        "Assistants get their own view: this week's calendar, practice plans for the next two weeks, their drafts, and player claims to approve."),
      row("Player menu", "The cafe-menu dashboard: TWIS, Goals, Pop Report, Mental GP, Softball IQ, Trophy Room.", ["yes", "yes", "own", "view", "part"],
        "Coaches open every player's menu. Parents view their daughter's, read only (View as on the family page). Mentors read Goals, the Pop Report and Mental GP of the players they're approved for."),
      row("Family page", "Their daughter's team: coming up on the calendar (and the month calendar), team standards, culture and season goals, her goals and team commitment, team budget totals (no names), her login, the Yearbook with G3 Advanced.", ["part", "part", "no", "yes", "no"],
        "A coach who is also a parent here claims their daughter from the dashboard (a head coach's claim is approved at once, an assistant's waits for the head coach) and gets this page too, with the Coach / Parent switch at the top."),
      row("My Journal", "Her notes and voice memos from mentor sessions (a pill in Mental GP).", ["no", "no", "own", "view", "part"],
        "Hers: her parents read it; a mentor reads only the entries she shares with them; coaches don't see it (the user's choice)."),
      row("Video calls", "Zoom calls with one player, held on GGG.Cafe and never recorded.", ["yes", "view", "part", "part", "part"],
        "Off until a site admin turns them on for a team; then the head coach switches them on for mentors (the Switchboard). Head coaches and her mentors book them; she and her parents are told and join; head coaches can drop in; assistants see them on the Calendar."),
      row("Mentor page", "My roster: the team's roster or her approved players, each with links to Goals, the Pop Report and Mental GP; a calendar of her training and video calls; messages with a photo or a drill (shared with coaches if she chooses), training for one player or a group, notes and focus areas with the coaches.", ["no", "no", "no", "no", "yes"]),
    ],
  },
  {
    title: "Coaches Dugout",
    rows: [
      row("Roster", "The season's roster, editing a player's name, profile and jersey number, player accounts, approvals, moving a player to another team, the coaching staff, and staff duties & standards (the duty matrix, the staff commitment, the before-practice checklist).", ["yes", "part", "no", "no", "no"],
        "Assistants edit players and approve player claims, and see the staff duties; parent requests, coach sign-ups and the duty matrix go to head coaches."),
      row("Culture", "Team Standards and Team Culture.", ["yes", "no", "view", "no", "no"], "Players read them in From the Dugout."),
      row("Calendar", "Practices and events, one time or repeating, that show on every player's TWIS; offseason dates.", ["yes", "yes", "view", "part", "no"],
        "Players see the dates in TWIS. A parent the head coach makes team admin changes the team's calendar (not the offseason dates)."),
      row("Practice Plans", "Build, finalize, print and share practice plans; notes and a cue for each player; the install checklist.", ["yes", "part", "part", "no", "no"],
        "Assistants view and print every plan but change only the plans they write (the head coach's are view only); they work the install checklist. Players see a plan's notes and their own cue in TWIS."),
      row("Training", "The season roadmap, team routines, athletic testing, the team's measurement list, bullpens, BP rounds graded swing by swing, the Team Hitting Philosophy, the Throwing Program for position players (Outies, Innies, Catchers), the offseason draft, and Coach training: Coaching the Mental Game, nine short modules for coaches with their own notes and the team's progress on the players' Mental GP lessons.", ["yes", "part", "view", "no", "no"],
        "Assistants plan phases, push routines, run testing and take Coach training, and read the hitting philosophy and throwing program; the head coach writes those two and runs the draft. Players see their phase, routines and results, the hitting philosophy and their group's throwing program on their Team page, never Coach training. Each coach's training notes are their own; admins see who finished which modules."),
      row("GameDay", "Player cards, lineups with DP/FLEX and game-day jobs, defensive rotations, the lineup and umpire cards, substitutions with the re-entry rule, the depth chart, and box scores with quality at-bat grades.", ["yes", "no", "no", "part", "no"],
        "A parent the head coach makes team admin works the team's GameDay too (everything but sharing a lineup with the staff)."),
      row("Playbook", "The team call sheet and organization playbook, team quizzes, and the scouting checklist on opponents.", ["yes", "yes", "part", "no", "no"],
        "Players see only the calls on their team's sheet (as flashcards) and published team quizzes; scouting stays with the staff."),
      row("Drill Library", "Every drill, tagged, with video links.", ["yes", "yes", "no", "no", "part"], "Mentors pick drills to suggest and can add new ones."),
      row("Budget", "Fees, payments, income and expenses (one at a time, or many at once from an Excel or CSV file), tournament credits, and out-of-pocket spending by coaches or parents and its repayment.", ["yes", "view", "no", "view", "no"],
        "Assistants see the whole budget but can't change it. Parents see team totals only, with no names."),
      row("Parents", "The team code, parent requests and approved parents, and which of them is a team admin.", ["yes", "no", "no", "no", "no"]),
      row("Mentors", "Approve mentors for the whole team, read their notes and focus areas and reply, read the messages they share.", ["yes", "no", "no", "part", "no"],
        "Parents approve a mentor for their daughter and read every message, note and focus area about her (family page). Admins read every message."),
    ],
  },
  {
    title: "Teams and players",
    rows: [
      row("Teams and seasons", "Register a team, seasons, games, opponents, the welcome message.", ["yes", "yes", "no", "no", "no"]),
      row("Players and intake", "Players page and Player intake: the official roster.", ["yes", "yes", "no", "no", "no"]),
      row("Coach-only notes", "Pop Report coach notes and Movement Preferences editing.", ["yes", "yes", "no", "no", "no"]),
      row("Leadership Guide picks", "Pick a player to train as a leader (Full Leadership Program or Leadership Light for 11 and under), sign off her plan, award the certificate.", ["yes", "yes", "own", "no", "no"],
        "The player works through her own guide when she has G3 Advanced and a coach picked her."),
      row("Offseason Leaderboard", "Team standings, Player of the Week, + Activity.", ["yes", "yes", "yes", "no", "no"]),
      row("Team Yearbook", "Season photos tagged by player (G3 Advanced).", ["yes", "yes", "view", "part", "no"],
        "Parents of a G3 Advanced player add photos; G3 Advanced players view them."),
      row("Notifications", "The bell: a new Player of the Week.", ["yes", "no", "no", "no", "no"]),
      row("Team measurements", "One measurement for the whole roster at once; each value shows on that player's Pop Report.", ["yes", "yes", "no", "part", "no"],
        "A parent the head coach makes team admin enters them for the team's current roster (names and numbers only; nothing else about the players)."),
      row("Switchboard", "Turn parts of the site on or off for a team, for Players, Parents and Mentors (the pill under the main menu).", ["yes", "no", "no", "no", "no"],
        "Head coaches and admins. Off hides it on the site and stops new posts; nothing saved is lost. Coaches always see everything."),
    ],
  },
  {
    title: "Accounts and approvals",
    rows: [
      row("Approve head coaches", "New head coach sign-ups.", ["no", "no", "no", "no", "no"], "Admins only."),
      row("Approve assistant coaches", "Assistant sign-ups for the head coach's team.", ["yes", "no", "no", "no", "no"]),
      row("Approve player claims", "Match a player's claim to her roster spot.", ["yes", "yes", "no", "no", "no"]),
      row("Approve parents", "Match a parent to the daughter on the roster.", ["yes", "no", "no", "no", "no"]),
      row("Make a parent team admin", "Let an approved parent change the team's calendar, GameDay and measurements.", ["yes", "no", "no", "no", "no"],
        "Coaches Dugout → Parents. The role ends if the parent's access is removed."),
      row("Create a player's login", "A username and password for a daughter without an email.", ["no", "no", "no", "own", "no"],
        "An approved parent, for a daughter on the team's current roster with her birth date on her profile. Under 13: only after an admin verifies the parent's consent."),
      row("Verify parental consent", "Check a parent's signed consent form, or hold a short video call, before a player under 13 can sign in (COPPA).", ["no", "no", "no", "own", "no"],
        "Parents give consent and can withdraw it on the family page. Admins check it on the Roster tab; coaches never see the forms."),
      row("Reset that login's password", "A new password for a parent-made player login.", ["yes", "no", "no", "own", "no"]),
      row("Medical & emergency card", "Emergency contacts, allergies, conditions and medications; a game-day view.", ["yes", "no", "no", "own", "no"],
        "Head coaches and her approved parents only (not assistants, teammates or the player)."),
      row("Preseason questionnaire", "Sizes (jersey, pants, socks), top three jersey numbers, positions she wants, goals.", ["view", "view", "no", "own", "no"],
        "Parents fill it in on the family page. Coaches see the team's answers on the Roster tab."),
      row("Welcome packet", "The coach's letter, team policies and how-to-help tips on the family page.", ["yes", "no", "no", "view", "no"],
        "Head coaches write it (Parents tab); approved parents read it and mark each item read."),
      row("Change roles, remove staff", "Head Coach, Assistant Coach or Viewer, on the Roster tab.", ["no", "no", "no", "no", "no"], "Admins only."),
      row("View as a parent or mentor", "See their family page or mentor home as they see it, read only, to help with their questions.", ["no", "no", "no", "no", "no"],
        "Admins only: Coaches Dugout → Parents or Mentors, or the View as page."),
    ],
  },
];

export const QUESTIONS: { q: string; a: string[] }[] = [
  {
    q: "Why does every sign-up confirm an email first?",
    a: [
      "So only real people with a working inbox get in. The link in the email finishes the sign-up; until it's opened, the account can't sign in.",
      "After confirming, every account still waits for a person to approve it: an admin for head coaches, a head coach for assistant coaches and parents, a coach for players, and a player's parents (one player) or the head coach (the whole team) for mentors.",
    ],
  },
  {
    q: "What is the team code, and who gets it?",
    a: [
      "Each team has one six-character code. Players, parents, assistant coaches and mentors choose their account type on the sign-up page and enter it; head coaches don't need one (an admin approves them).",
      "Coaches see the code in Coaches Dugout → Roster (and Parents). A head coach turns sign-up on, makes a new code (the old one stops working) or turns it off; everyone already approved keeps access.",
      "A code only lets someone ask to join: every sign-up still waits for approval. Signed-out visitors can't see the list of teams.",
    ],
  },
  {
    q: "A player has no email. How does she get in?",
    a: [
      "Her parent signs up as a Parent with the team code. Once a head coach approves the parent, the family page shows \"Create her login\": the parent picks a username and password.",
      "It works only for a daughter on the official roster the head coach built for the current season, with her birth date on her profile, and only once per player. She signs in with the username instead of an email; her parent or a head coach can reset the password.",
      "If she's under 13, the parent first gives verified consent on the family page: signs our consent form by hand and uploads a photo of it, or asks for a short video call. An admin checks it on the Roster tab, then \"Create her login\" appears. A coach can't approve an under-13 player's own profile claim until that consent is checked.",
    ],
  },
  {
    q: "What can't an assistant coach do?",
    a: [
      "Assistants don't get Culture, GameDay, Parents or Mentors in the Coaches Dugout, and they don't approve parents or other coaches.",
      "They see every practice plan and can print it, but change only the plans they write. The head coach's plans are view only for them.",
    ],
  },
  {
    q: "Where does the admin fit?",
    a: [
      "The admin isn't a sign-up type. It has everything a head coach has, plus approving head coaches, approving any mentor request, reading every mentor message, checking parents' consent for players under 13, changing roles, these FAQ pages and Site health (errors, the job worker, connected services). Head coaches and admins both unlock G3 Advanced for a player (Coaches Dugout → Roster).",
    ],
  },
  {
    q: "A coach is also a parent on the team. Do they need two logins?",
    a: [
      "No. Coach sign-ups can tick \"I'm also a parent\" and name their daughter. Once approved, the coach claims her from the dashboard (\"Also a parent on the team?\"): a head coach's claim is approved at once, an assistant's waits for the head coach like any parent's.",
      "Then a Coach / Parent switch sits at the top of every page: Coach opens the dashboard, Parent opens the family page with the parents' menu.",
    ],
  },
  {
    q: "What can a team admin parent do?",
    a: [
      "A head coach makes an approved parent the team admin on Coaches Dugout → Parents. That parent gets a Coaches Dugout with three tabs for that team: Calendar, GameDay (lineups, player cards, depth chart, box scores) and Measurements (each value lands on the player's Pop Report).",
      "Nothing else opens: they see teammates only by name, number and position, never coach notes, medical cards, the budget details or other teams. Taking the role away, or removing the parent, ends it.",
    ],
  },
  {
    q: "What does the Switchboard turn off?",
    a: [
      "Head coaches (and admins) open it from the Switchboard pill under the main menu. For one team, it turns off features for Players (Goals, Pop Report, Mental GP, My Journal, Training, Softball IQ, Trophy Room, Leaderboard, + Activity, Team page, Yearbook), Parents (Team Budget, welcome packet, questionnaire, View as player, Yearbook, Calendar, Team Standards & Culture, Her goals) and Mentors (messages, training, notes, what they can see, and video calls once a site admin turns calls on for the team).",
      "Off hides it on the site and stops new posts; nothing saved is deleted, and switching it back on brings it all back. Some things stay on for safety or the law: TWIS, the medical card, her login and consent, and parents' oversight of mentors. A player on two teams loses a feature if either team turns it off.",
    ],
  },
  {
    q: "How do video calls work, and who can use them?",
    a: [
      "They're off for every team until a site admin turns them on for that team on the Switchboard. Then the team's head coach decides whether mentors can book them too (Mentors → Video calls, off at first). With a team's calls off, nobody on it can book, start or join one; a player on two teams needs both to allow it.",
      "Head coaches book calls on Coaches Dugout → Calendar, mentors on the player's page. Each call is with one player: she and her approved parents are told (the bell) and join from the call page, which opens 10 minutes early; head coaches can drop in. Everyone waits in Zoom's waiting room until the host lets them in, and nothing is recorded.",
    ],
  },
  {
    q: "How do I change someone's role or remove them?",
    a: ["Coaches Dugout → Roster → Coaching staff. Admins can switch anyone between Head Coach, Assistant Coach and Viewer, or remove them from the staff."],
  },
  {
    q: "What does everyone agree to?",
    a: [
      "The Terms of Service and the Privacy & Security Notice: with a checkbox at sign-up, or on a one-time page the next time they open GGG.Cafe (accounts made before the Terms, and player logins a parent made). A parent or guardian agrees for a player under 18. Players under 13 can't sign themselves up: a parent gives verified consent, then makes their login.",
      "Each agreement is saved with its date and version. When the Terms change in a way that matters, everyone is asked again.",
    ],
  },
  {
    q: "Can people put GGG.Cafe on their phone like an app?",
    a: [
      "Yes, with nothing to download from an app store. iPhone: open the site in Safari, tap Share, then Add to Home Screen. Android: open it in Chrome and tap Install app (or Add to Home screen in the ⋮ menu).",
      "It opens full screen with the GGG.Cafe icon and goes straight to each person's own home page. Everyone signs in once inside the app (an iPhone keeps home-screen apps signed in separately from Safari). Updates arrive on their own, and nothing is saved on the phone for offline use.",
    ],
  },
];
