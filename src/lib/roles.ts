// Staff roles (user, 2026-11-08) and what each one gets in the Coaches Dugout.
//   coach     = Head Coach (an admin approves the sign-up)
//   assistant = Assistant Coach (a head coach approves the sign-up)
//   admin     = the site admin: everything a head coach has, plus staff, mentors, G3 Advanced
//   viewer    = read-only staff (no sign-up; an admin adds them)
// The database enforces the same rules (private.can_edit / is_head_coach /
// can_edit_plan). No imports, so client components and unit tests can use it.

export type StaffRole = "viewer" | "assistant" | "coach" | "admin";

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  coach: "Head Coach",
  assistant: "Assistant Coach",
  viewer: "Viewer",
};

export const ROLE_NOTE: Record<StaffRole, string> = {
  admin: "Admin · everything a head coach has, plus staff, mentors and G3 Advanced",
  coach: "Head Coach · your teams, your staff and your players",
  assistant: "Assistant Coach · roster, calendar, practice plans, training, the playbook and drills; views the team budget",
  viewer: "Viewer · read only",
};

/** Coaches, assistants and admins change data; viewers only read. */
export function canEditRole(role: StaffRole | null | undefined): boolean {
  return role === "coach" || role === "assistant" || role === "admin";
}

/** Head coaches and admins: culture, GameDay, parents, mentors and every practice plan. */
export function isHeadCoachRole(role: StaffRole | null | undefined): boolean {
  return role === "coach" || role === "admin";
}

/** The Coaches Dugout tabs, in order. `headOnly` tabs aren't in an assistant's Dugout. */
export const DUGOUT_TABS = [
  { href: "/dugout/roster", label: "Roster", headOnly: false },
  { href: "/dugout", label: "Culture", headOnly: true },
  { href: "/dugout/calendar", label: "Calendar", headOnly: false },
  { href: "/dugout/plans", label: "Practice Plans", headOnly: false },
  { href: "/dugout/training", label: "Training", headOnly: false },
  { href: "/dugout/gameday", label: "GameDay", headOnly: true },
  { href: "/dugout/playbook", label: "Playbook", headOnly: false },
  { href: "/dugout/drills", label: "Drill Library", headOnly: false },
  { href: "/dugout/budget", label: "Budget", headOnly: false },
  { href: "/dugout/parents", label: "Parents", headOnly: true },
  { href: "/dugout/mentors", label: "Mentors", headOnly: true },
] as const;

export type DugoutTab = { href: string; label: string; headOnly: boolean };

/** A team admin's Dugout (a parent the head coach made team admin; user, 2026-11-12). */
export const TEAM_ADMIN_TABS: DugoutTab[] = [
  { href: "/dugout/calendar", label: "Calendar", headOnly: false },
  { href: "/dugout/gameday", label: "GameDay", headOnly: false },
  { href: "/dugout/measurements", label: "Measurements", headOnly: false },
];

/** The tabs a role sees. Assistants skip Culture, GameDay, Parents and Mentors (and the draft inside Training); everyone else sees all. */
export function dugoutTabsFor(role: StaffRole | null | undefined): DugoutTab[] {
  return DUGOUT_TABS.filter((t) => !(t.headOnly && role === "assistant"));
}

/** Practice plans: head coaches and admins change any; an assistant only the plans she wrote. */
export function canEditPlanRole(role: StaffRole | null | undefined, userId: string, createdBy: string | null): boolean {
  if (isHeadCoachRole(role)) return true;
  return role === "assistant" && createdBy !== null && createdBy === userId;
}

/** What a coach sign-up asks to become, from the sign-up form's account type. */
export const COACH_SIGNUP_ROLE = { "head-coach": "coach", "assistant-coach": "assistant" } as const;
export type CoachSignup = keyof typeof COACH_SIGNUP_ROLE;
export function isCoachSignup(type: unknown): type is CoachSignup {
  return type === "head-coach" || type === "assistant-coach";
}
