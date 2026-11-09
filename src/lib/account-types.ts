// The five account types (user, 2026-11-08): how each one signs up, its home
// page, and what it can use, side by side. Drawn by the admin-only FAQ at
// /faq/accounts; the sign-up form uses SIGNUP_TYPES. Keep it in step with the
// site (src/lib/roles.ts, the 20261108210100_account_types migration) whenever
// a feature or its access changes. No imports, so it runs in unit tests.

export const SIGNUP_TYPES = ["head-coach", "assistant-coach", "player", "parent", "mentor"] as const;
export type SignupType = (typeof SIGNUP_TYPES)[number];
/** The account types that sign up with their team's code (teams.team_code). */
export const CODE_TYPES: readonly SignupType[] = ["player", "parent", "assistant-coach"];

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
    signup: "Signs up with an email and confirms it; an admin approves. Registers the team and builds the official roster.",
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
    signup: "Signs up with an email and the team code, then claims her spot on the roster (a coach approves), or her parent creates a username login for her.",
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
    signup: "Mentors and skill coaches sign up with an email and confirm it; an admin approves; a head coach assigns players.",
    home: "Mentor page: assigned players",
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
      row("Player menu", "The cafe-menu dashboard: TWIS, Goals, Pop Report, Mental GP, Softball IQ, Trophy Room.", ["yes", "yes", "own", "no", "part"],
        "Coaches open every player's menu. Mentors read Goals, the Pop Report and Mental GP of the players assigned to them."),
      row("Family page", "Their daughter's team, team budget totals (no names), her login, the Yearbook with G3 Advanced.", ["no", "no", "no", "yes", "no"]),
      row("Mentor page", "Assigned players, messages with a photo or a drill, optional calendar dates.", ["no", "no", "no", "no", "yes"]),
    ],
  },
  {
    title: "Coaches Dugout",
    rows: [
      row("Roster", "The season's roster, player accounts, approvals, the coaching staff, and staff duties & standards (the duty matrix, the staff commitment, the before-practice checklist).", ["yes", "part", "no", "no", "no"],
        "Assistants approve player claims and see the staff duties; parent requests, coach sign-ups and the duty matrix go to head coaches."),
      row("Culture", "Team Standards and Team Culture.", ["yes", "no", "view", "no", "no"], "Players read them in From the Dugout."),
      row("Calendar", "Practices and events that show in TWIS; offseason dates.", ["yes", "yes", "view", "no", "no"], "Players see the dates in TWIS."),
      row("Practice Plans", "Build, finalize, print and share practice plans; notes and a cue for each player; the install checklist.", ["yes", "part", "part", "no", "no"],
        "Assistants view and print every plan but change only the plans they write (the head coach's are view only); they work the install checklist. Players see a plan's notes and their own cue in TWIS."),
      row("Training", "The season roadmap, team routines, athletic testing, bullpens, BP rounds graded swing by swing, and the offseason draft.", ["yes", "part", "view", "no", "no"],
        "Assistants plan phases, push routines and run testing; the draft is head coach only. Players see their phase, routines and results."),
      row("GameDay", "Player cards, lineups with DP/FLEX and game-day jobs, defensive rotations, the lineup and umpire cards, substitutions with the re-entry rule, the depth chart, and box scores with quality at-bat grades.", ["yes", "no", "no", "no", "no"]),
      row("Playbook", "The team call sheet and organization playbook, team quizzes, and the scouting checklist on opponents.", ["yes", "yes", "part", "no", "no"],
        "Players see only the calls on their team's sheet (as flashcards) and published team quizzes; scouting stays with the staff."),
      row("Drill Library", "Every drill, tagged, with video links.", ["yes", "yes", "no", "no", "part"], "Mentors pick drills to suggest and can add new ones."),
      row("Team Budget", "Fees, payments, income and expenses.", ["yes", "view", "no", "view", "no"],
        "Assistants see the whole budget but can't change it. Parents see team totals only, with no names."),
      row("Parents", "The team code, parent requests and approved parents.", ["yes", "no", "no", "no", "no"]),
      row("Mentors", "Assign players to mentors, read and remove messages.", ["yes", "no", "no", "no", "no"], "An admin approves new mentors."),
    ],
  },
  {
    title: "Teams and players",
    rows: [
      row("Teams and seasons", "Register a team, seasons, games, opponents, the welcome message.", ["yes", "yes", "no", "no", "no"]),
      row("Players and intake", "Players page and Player intake: the official roster.", ["yes", "yes", "no", "no", "no"]),
      row("Coach-only notes", "Pop Report coach notes and Movement Preferences editing.", ["yes", "yes", "no", "no", "no"]),
      row("Leadership Guide picks", "Pick a player to train as a leader, sign off her plan, award the certificate.", ["yes", "yes", "own", "no", "no"],
        "The player works through her own guide when she has G3 Advanced and a coach picked her."),
      row("Offseason Leaderboard", "Team standings, Player of the Week, + Activity.", ["yes", "yes", "yes", "no", "no"]),
      row("Team Yearbook", "Season photos tagged by player (G3 Advanced).", ["yes", "yes", "view", "part", "no"],
        "Parents of a G3 Advanced player add photos; G3 Advanced players view them."),
      row("Notifications", "The bell: a new Player of the Week.", ["yes", "no", "no", "no", "no"]),
    ],
  },
  {
    title: "Accounts and approvals",
    rows: [
      row("Approve head coaches", "New head coach sign-ups.", ["no", "no", "no", "no", "no"], "Admins only."),
      row("Approve assistant coaches", "Assistant sign-ups for the head coach's team.", ["yes", "no", "no", "no", "no"]),
      row("Approve player claims", "Match a player's claim to her roster spot.", ["yes", "yes", "no", "no", "no"]),
      row("Approve parents", "Match a parent to the daughter on the roster.", ["yes", "no", "no", "no", "no"]),
      row("Create a player's login", "A username and password for a daughter without an email.", ["no", "no", "no", "own", "no"],
        "An approved parent, for a daughter on the team's current roster."),
      row("Reset that login's password", "A new password for a parent-made player login.", ["yes", "no", "no", "own", "no"]),
      row("Medical & emergency card", "Emergency contacts, allergies, conditions and medications; a game-day view.", ["yes", "no", "no", "own", "no"],
        "Head coaches and her approved parents only (not assistants, teammates or the player)."),
      row("Preseason questionnaire", "Sizes, top three jersey numbers, positions she wants, goals.", ["yes", "yes", "own", "own", "no"]),
      row("Welcome packet", "The coach's letter, team policies and how-to-help tips on the family page.", ["yes", "no", "no", "view", "no"],
        "Head coaches write it (Parents tab); approved parents read it and mark each item read."),
      row("Change roles, remove staff", "Head Coach, Assistant Coach or Viewer, on the Roster tab.", ["no", "no", "no", "no", "no"], "Admins only."),
    ],
  },
];

export const QUESTIONS: { q: string; a: string[] }[] = [
  {
    q: "Why does every sign-up confirm an email first?",
    a: [
      "So only real people with a working inbox get in. The link in the email finishes the sign-up; until it's opened, the account can't sign in.",
      "After confirming, every account still waits for a person to approve it: an admin for head coaches and mentors, a head coach for assistant coaches and parents, a coach for players.",
    ],
  },
  {
    q: "What is the team code, and who gets it?",
    a: [
      "Each team has one six-character code. Players, parents and assistant coaches choose their account type on the sign-up page and enter it; head coaches and mentors don't need one (an admin approves them).",
      "Coaches see the code in Coaches Dugout → Roster (and Parents). A head coach turns sign-up on, makes a new code (the old one stops working) or turns it off; everyone already approved keeps access.",
      "A code only lets someone ask to join: every sign-up still waits for approval. Signed-out visitors can't see the list of teams.",
    ],
  },
  {
    q: "A player has no email. How does she get in?",
    a: [
      "Her parent signs up as a Parent with the team code. Once a head coach approves the parent, the family page shows \"Create her login\": the parent picks a username and password.",
      "It works only for a daughter on the official roster the head coach built for the current season, and only once per player. She signs in with the username instead of an email; her parent or a head coach can reset the password.",
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
      "The admin isn't a sign-up type. It has everything a head coach has, plus approving head coaches and mentors, changing roles, G3 Advanced and these FAQ pages.",
    ],
  },
  {
    q: "How do I change someone's role or remove them?",
    a: ["Coaches Dugout → Roster → Coaching staff. Admins can switch anyone between Head Coach, Assistant Coach and Viewer, or remove them from the staff."],
  },
  {
    q: "Can people put GGG.Cafe on their phone like an app?",
    a: [
      "Yes, with nothing to download from an app store. iPhone: open the site in Safari, tap Share, then Add to Home Screen. Android: open it in Chrome and tap Install app (or Add to Home screen in the ⋮ menu).",
      "It opens full screen with the GGG.Cafe icon and goes straight to each person's own home page. Everyone signs in once inside the app (an iPhone keeps home-screen apps signed in separately from Safari). Updates arrive on their own, and nothing is saved on the phone for offline use.",
    ],
  },
];
