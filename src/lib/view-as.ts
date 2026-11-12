// What admin_view_parent() and admin_view_mentor() return (migration 20261112011925): one read of a
// parent's or a mentor's page, answered by the database as that person, for admins to troubleshoot
// (user, 2026-11-12). No imports, so the types can be shared.

export type ViewAccount = {
  id: string;
  email: string | null;
  created_at: string | null;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  display_name: string | null;
  signed_up_as: string | null;
};

export type ParentView = {
  account: ViewAccount;
  profile: { display_name: string } | null;
  links: { link_id: string; team_id: string; team_name: string; child_name: string; player_name: string | null; status: "pending" | "approved" | "declined" }[];
  daughters: {
    player_id: string;
    player_name: string;
    team_name: string;
    on_roster: boolean;
    username: string | null;
    has_account: boolean;
    questionnaire: Record<string, unknown> | null;
    medical: Record<string, string | null> | null;
  }[];
  consent: { player_id: string; under_13: boolean; status: string | null; method: string | null; submitted_at: string | null; reviewed_at: string | null }[];
  packet: { id: string; team_id: string; kind: string; title: string }[];
  packet_read: string[];
  mentor_links: { mentor_id: string; team_id: string | null; player_id: string | null; status: string }[];
  mentors: { user_id: string; display_name: string; specialty: string | null }[];
  budgets: unknown[];
  yearbook_teams: string[];
  logos: { team_id: string; team_name: string; logo_path: string }[];
};

export type MentorView = {
  account: ViewAccount;
  mentor: { display_name: string; specialty: string | null; approved_at: string } | null;
  links: { id: string; team_id: string | null; team_name: string | null; player_id: string | null; player_name: string | null; status: string; requested_at: string }[];
  players: { id: string; name: string; position: string | null; team: string | null; jersey: string | null }[];
  messages: { player_id: string; body: string | null; drill_name: string | null; has_photo: boolean; created_at: string; read_at: string | null; shared_with_coaches: boolean }[];
  training: { player_id: string; title: string; starts_on: string; ends_on: string }[];
  notes: number;
  focus: number;
};

/** "Approved" / "Waiting for coach" / "Not approved": how the parent sees a team request. */
export const LINK_STATUS: Record<string, string> = { approved: "Approved", pending: "Waiting for coach", declined: "Not approved" };

/** How a parent's page describes a daughter's login. */
export function loginStatus(d: ParentView["daughters"][number]) {
  const first = d.player_name.split(" ")[0];
  if (d.username) return `${first} signs in with the username ${d.username}.`;
  if (d.has_account) return `${first} has her own account and signs in with her email.`;
  if (!d.on_roster) return `${first} isn't on the team's current roster yet, so the login form isn't shown.`;
  return `No login yet: the parent sees the form to make ${first} a username and password.`;
}
