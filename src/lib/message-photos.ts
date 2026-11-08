import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { MESSAGE_PHOTO_BUCKET } from "@/lib/mentors";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Short-lived links to message photos (Storage checks: the sender, the player, or staff). Path → URL. */
export async function signedMessagePhotoUrls(supabase: Supabase, paths: (string | null | undefined)[], expiresIn = 3600) {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const urls = new Map<string, string>();
  if (wanted.length === 0) return urls;
  const { data, error } = await supabase.storage.from(MESSAGE_PHOTO_BUCKET).createSignedUrls(wanted, expiresIn);
  if (error) {
    console.error("Signing message photos failed:", error);
    return urls;
  }
  for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  return urls;
}

export type MentorMessage = {
  id: string;
  player_id: string;
  sender_id: string;
  sender_name: string;
  body: string | null;
  photo_path: string | null;
  drill_name: string | null;
  drill_video_url: string | null;
  created_at: string;
  read_at: string | null;
};

export const MESSAGE_COLUMNS = "id, player_id, sender_id, sender_name, body, photo_path, drill_name, drill_video_url, created_at, read_at";
