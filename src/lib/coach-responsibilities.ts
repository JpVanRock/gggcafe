// Coach's Responsibilities (the user's own list, 2026-11-11): the pill at the bottom of the
// Coaches Dugout opens it. Coaches only; players and parents don't see it. `key: true` marks
// the ones the user set in bold. No imports, so it runs in unit tests.

export const COACH_RESPONSIBILITIES_TITLE = "Coach's Responsibilities";
export const COACH_RESPONSIBILITIES_MOTTO = "Teaching Creates Understanding";

export const COACH_RESPONSIBILITIES: { text: string; key?: boolean }[] = [
  { text: "Sets the Vision & Culture of the Program" },
  { text: "Leads and Manages Coaching Staff" },
  { text: "Understands Player's Learning Language", key: true },
  { text: "Designs Team Strategy & Mission" },
  { text: "Develops Practice Structure" },
  { text: "Makes In-Game Decisions" },
  { text: "Player Development & Accountability", key: true },
  { text: "Builds Relationships with Players & Families" },
  { text: "Communicates Expectations Clearly & Consistently" },
  { text: "Evaluates Team & Individual Performance" },
  { text: "Develops Recruiting Strategy" },
  { text: "Oversees Daily Operations & Organization" },
  { text: "Represents the Program with Professionalism" },
  { text: "Creates a Winning & Positive Culture", key: true },
  { text: "Takes Responsibility for Results" },
  { text: "Creates Systems for Player Success" },
];

/** Coaching Etiquette (the user's second sheet, 2026-11-11), under the list in the same pop-up. */
export const COACHING_ETIQUETTE_TITLE = "Coaching Etiquette";
export const COACHING_ETIQUETTE_MOTTO = "Creating a Habit of Excellence";
export const COACHING_ETIQUETTE = [
  "Understand each player is different and each player brings something to the table. There is a reason each girl made the team.",
  "Try to see the game from each player's point of view. Be open to listening to players, and let them play their game.",
  "Care about players. Challenge, but do not crush confidence. Observe body language and hold players to a standard. Coach from a place of belief in each player rather than ego.",
  "Not just making better softball players, but better athletes and good people.",
];
