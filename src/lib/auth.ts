import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditRole, isHeadCoachRole, type StaffRole } from "@/lib/roles";
import { loadRoster, type RosterPlayer } from "@/lib/roster";

export type { StaffRole };

export type CurrentUser = {
  id: string;
  email: string | null;
  /** null when signed in but not (yet) added to the staff list */
  staff: { displayName: string; role: StaffRole } | null;
};

/**
 * The signed-in user, verified against Supabase Auth, plus their staff record.
 * Returns null when signed out. Reads cookies, so call it inside <Suspense>.
 * Cached per request, so calling it from several components is cheap.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const userId = data.claims.sub;
  const { data: staff } = await supabase
    .from("staff")
    .select("display_name, role")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    id: userId,
    email: (data.claims.email as string | undefined) ?? null,
    staff: staff
      ? { displayName: staff.display_name as string, role: staff.role as StaffRole }
      : null,
  };
});

/** Coaches, assistants and admins change data; viewers only read. */
export function canEdit(role: StaffRole) {
  return canEditRole(role);
}

/** Head coaches and admins: culture, GameDay, parents, mentors, every practice plan. */
export function isHeadCoach(role: StaffRole) {
  return isHeadCoachRole(role);
}

export type StaffUser = CurrentUser & { staff: NonNullable<CurrentUser["staff"]> };

/**
 * For staff pages: the signed-in staff member, or a redirect to /login
 * (signed out) or /dashboard (signed in but not on staff, which explains why).
 */
export async function requireStaffPage(): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.staff) redirect("/dashboard");
  return user as StaffUser;
}

/**
 * For the Dugout pages assistants don't get (Culture, GameDay, Parents, Mentors):
 * a 404 for an Assistant Coach. Viewers still read them.
 */
export async function requireHeadCoachPage(): Promise<StaffUser> {
  const user = await requireStaffPage();
  if (user.staff.role === "assistant") notFound();
  return user;
}

/** For head-coach-only server actions: an error message unless the user is a head coach or admin. */
export async function headCoachCheck(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has ended. Sign in again.";
  if (!user.staff || !isHeadCoach(user.staff.role)) return "Only a head coach can change this.";
  return null;
}

/** For admin-only server actions (e.g. granting G3 Advanced): an error message unless the user is an admin. */
export async function adminCheck(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has ended. Sign in again.";
  if (user.staff?.role !== "admin") return "Only an admin can do that.";
  return null;
}

/** For server actions that change data: an error message unless the user is a coach or admin. */
export async function editorCheck(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has ended. Sign in again.";
  if (!user.staff || !canEdit(user.staff.role)) {
    return "You don't have permission to change this. Ask an admin to make you a coach.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Players with a claimed profile (see the player_claims migration). The
// database decides; these helpers only route pages and give clear messages.
// ---------------------------------------------------------------------------

/** Player profiles the signed-in user has claimed for her team's current season. */
export const getMyPlayerIds = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_player_ids");
  return ((data ?? []) as (string | { my_player_ids: string })[]).map((r) => (typeof r === "string" ? r : r.my_player_ids));
});

export type PlayerPageAccess = {
  user: CurrentUser;
  /** coach or admin: everything, including coach-only tools */
  canManage: boolean;
  /** coach/admin, or the player herself (her goals, routines, TWIS, IQ tests) */
  canAct: boolean;
  /** the signed-in user is this player */
  isSelf: boolean;
};

/** For a player's dashboard: staff, or the player herself. Others are sent home. */
export async function requirePlayerPage(playerId: string): Promise<PlayerPageAccess> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canManage = Boolean(user.staff && canEdit(user.staff.role));
  if (user.staff) return { user, canManage, canAct: canManage, isSelf: false };
  const mine = await getMyPlayerIds();
  if (!mine.includes(playerId)) redirect("/me");
  return { user, canManage: false, canAct: true, isSelf: true };
}

/** For server actions on one player's data: an error message unless coach/admin or the player herself. */
export async function actForCheck(playerId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has ended. Sign in again.";
  if (user.staff && canEdit(user.staff.role)) return null;
  if ((await getMyPlayerIds()).includes(playerId)) return null;
  return "You don't have permission to change this.";
}

/** For server actions that only name a row (the database checks the row is hers). */
export async function actorCheck(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has ended. Sign in again.";
  if (user.staff && canEdit(user.staff.role)) return null;
  if ((await getMyPlayerIds()).length > 0) return null;
  return "You don't have permission to change this.";
}

// ---------------------------------------------------------------------------
// Mentors (not staff): a player's parents approve a mentor for her, the head coach
// for the whole team (mentor_links). What she sees follows those approvals.
// ---------------------------------------------------------------------------

export type MentorRecord = { userId: string; displayName: string; specialty: string | null };

/** The signed-in user's mentor profile (made with her first request), approved or not. */
export const getMentor = cache(async (): Promise<MentorRecord | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("mentors").select("user_id, display_name, specialty").eq("user_id", user.id).maybeSingle();
  if (!data) return null;
  return { userId: data.user_id, displayName: data.display_name, specialty: data.specialty ?? null };
});

export type MentorAccess = {
  /** players approved one by one (by their parents or an admin) */
  playerIds: string[];
  /** teams she works with as a whole (the head coach approved) */
  teamIds: string[];
  /** every player she works with: the ones above plus those teams' current rosters */
  menteeIds: string[];
  /** those teams' current rosters */
  rosters: { teamId: string; players: RosterPlayer[] }[];
};

/** Who the signed-in mentor works with, from her approved links. */
export const getMentorAccess = cache(async (): Promise<MentorAccess> => {
  const mentor = await getMentor();
  if (!mentor) return { playerIds: [], teamIds: [], menteeIds: [], rosters: [] };
  const supabase = await createClient();
  const { data } = await supabase.from("mentor_links").select("team_id, player_id").eq("mentor_id", mentor.userId).eq("status", "approved");
  const links = data ?? [];
  const playerIds = [...new Set(links.flatMap((l) => (l.player_id ? [l.player_id] : [])))];
  const teamIds = [...new Set(links.flatMap((l) => (!l.player_id && l.team_id ? [l.team_id] : [])))];
  const rosters = await Promise.all(teamIds.map((t) => loadRoster(supabase, t)));
  const menteeIds = [...new Set([...playerIds, ...rosters.flat().map((p) => p.id)])];
  return { playerIds, teamIds, menteeIds, rosters: teamIds.map((teamId, i) => ({ teamId, players: rosters[i] })) };
});

/** Player ids the signed-in mentor works with. */
export const getMenteeIds = cache(async (): Promise<string[]> => (await getMentorAccess()).menteeIds);

/** For mentor actions: an error message unless she's an approved mentor and (if given) the player or team is hers. */
export async function mentorCheck(playerId?: string, teamId?: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has ended. Sign in again.";
  const mentor = await getMentor();
  const access = await getMentorAccess();
  if (!mentor || access.menteeIds.length + access.teamIds.length === 0) return "Only approved mentors can do that.";
  if (playerId && !access.menteeIds.includes(playerId)) return "That player isn't one of yours.";
  if (teamId && !access.teamIds.includes(teamId)) return "You don't work with that whole team.";
  return null;
}
