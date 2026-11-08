import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { YEARBOOK_BUCKET, type YearbookData } from "@/lib/yearbook";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** A team's yearbook for a season (current by default) with short-lived photo links. Null if she can't see it. */
export async function loadYearbook(supabase: Supabase, teamId: string, seasonId?: string | null) {
  const { data, error } = await supabase.rpc("team_yearbook", { p_team_id: teamId, ...(seasonId ? { p_season_id: seasonId } : {}) });
  if (error || !data) return null;
  const yearbook = data as YearbookData;
  const paths = yearbook.photos.flatMap((p) => [p.path, p.thumb_path]);
  const urls: Record<string, string> = {};
  for (let i = 0; i < paths.length; i += 500) {
    const { data: signed } = await supabase.storage.from(YEARBOOK_BUCKET).createSignedUrls(paths.slice(i, i + 500), 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }
  return { yearbook, urls };
}

/** The teams whose yearbook she may open, from a list of team ids. */
export async function yearbookTeams(supabase: Supabase, teamIds: string[]) {
  const access = await Promise.all(teamIds.map(async (id) => ({ id, access: (await supabase.rpc("yearbook_access", { p_team_id: id })).data as string | null })));
  return access.filter((a) => a.access).map((a) => a.id);
}
