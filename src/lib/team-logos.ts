import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const LOGO_BUCKET = "team-logos";

/**
 * A short-lived link to a team's logo in the private team-logos bucket (Storage lets any
 * signed-in user read it; signed-out visitors get nothing). Null when there's no logo.
 */
export async function signedLogoUrl(supabase: Supabase, path: string | null | undefined, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, expiresIn);
  if (error) {
    console.error("Signing the team logo failed:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}
