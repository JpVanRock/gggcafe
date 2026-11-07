import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const PHOTO_BUCKET = "player-photos";

/**
 * Short-lived links to profile pictures in the private player-photos bucket
 * (Storage checks that the viewer is staff). Path → URL; missing paths are skipped.
 */
export async function signedPhotoUrls(supabase: Supabase, paths: (string | null | undefined)[], expiresIn = 3600) {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const urls = new Map<string, string>();
  if (wanted.length === 0) return urls;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(wanted, expiresIn);
  if (error) {
    console.error("Signing player photos failed:", error);
    return urls;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
