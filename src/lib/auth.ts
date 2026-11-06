import "server-only";
import { cache } from "react";
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
