import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "viewer" | "coach" | "admin";

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

export function canEdit(role: StaffRole) {
  return role === "coach" || role === "admin";
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
