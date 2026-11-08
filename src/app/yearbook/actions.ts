"use server";

// Team Yearbook actions, shared by the player, Coaches Dugout and family pages.
// The database decides who may do what (private.yearbook_access): coaches/admins
// manage; parents of G3 Advanced players add and edit their own uploads.
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { friendlyDbError } from "@/lib/form";
import { isUuid } from "@/lib/softball";
import { createClient } from "@/lib/supabase/server";
import { YEARBOOK_BUCKET, cleanCaption } from "@/lib/yearbook";

type Result = { error: string | null };
const PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9]{10,16}-[a-z0-9]{4,12}\.jpg$/;

/** New photos (already uploaded to Storage), with one caption, day and set of tags for the batch. */
export async function addYearbookPhotos(input: {
  teamId: string;
  seasonId: string;
  photos: { path: string; thumbPath: string; width: number; height: number }[];
  caption?: string;
  takenOn?: string;
  tags?: string[];
}): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Your session has ended. Sign in again." };
  if (!isUuid(input.teamId) || !isUuid(input.seasonId)) return { error: "Unknown team." };
  const photos = (input.photos ?? []).filter((p) => PATH.test(p.path) && p.thumbPath === p.path.replace(/\.jpg$/, "_t.jpg"));
  if (photos.length === 0) return { error: "Add at least one photo." };
  const takenOn = input.takenOn && /^\d{4}-\d{2}-\d{2}$/.test(input.takenOn) ? input.takenOn : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("yearbook_photos")
    .insert(
      photos.map((p) => ({
        team_id: input.teamId,
        season_id: input.seasonId,
        path: p.path,
        thumb_path: p.thumbPath,
        width: Math.round(p.width) || null,
        height: Math.round(p.height) || null,
        caption: cleanCaption(input.caption),
        taken_on: takenOn,
      })),
    )
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  const tags = (input.tags ?? []).filter(isUuid);
  if (tags.length && data?.length) {
    const { error: tagError } = await supabase
      .from("yearbook_photo_tags")
      .insert((data as { id: string }[]).flatMap((p) => tags.map((t) => ({ photo_id: p.id, player_id: t }))));
    if (tagError) return { error: friendlyDbError(tagError) };
  }
  refresh();
  return { error: null };
}

/** Who's in the photo: replaces its tags. */
export async function setYearbookTags(input: { photoId: string; playerIds: string[] }): Promise<Result> {
  if (!isUuid(input.photoId)) return { error: "Unknown photo." };
  const wanted = [...new Set(input.playerIds.filter(isUuid))];
  const supabase = await createClient();
  const { data } = await supabase.from("yearbook_photo_tags").select("player_id").eq("photo_id", input.photoId);
  const have = ((data ?? []) as { player_id: string }[]).map((r) => r.player_id);
  const remove = have.filter((id) => !wanted.includes(id));
  const add = wanted.filter((id) => !have.includes(id));
  if (remove.length) {
    const { error } = await supabase.from("yearbook_photo_tags").delete().eq("photo_id", input.photoId).in("player_id", remove);
    if (error) return { error: friendlyDbError(error) };
  }
  if (add.length) {
    const { error } = await supabase.from("yearbook_photo_tags").insert(add.map((player_id) => ({ photo_id: input.photoId, player_id })));
    if (error) return { error: friendlyDbError(error) };
  }
  refresh();
  return { error: null };
}

export async function setYearbookCaption(input: { photoId: string; caption: string; takenOn: string }): Promise<Result> {
  if (!isUuid(input.photoId)) return { error: "Unknown photo." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("yearbook_photos")
    .update({ caption: cleanCaption(input.caption), taken_on: /^\d{4}-\d{2}-\d{2}$/.test(input.takenOn) ? input.takenOn : null }, { count: "exact" })
    .eq("id", input.photoId);
  if (error) return { error: friendlyDbError(error) };
  if (!count) return { error: "Only the person who added it, or a coach, can change it." };
  refresh();
  return { error: null };
}

export async function deleteYearbookPhoto(input: { photoId: string }): Promise<Result> {
  if (!isUuid(input.photoId)) return { error: "Unknown photo." };
  const supabase = await createClient();
  const { data } = await supabase.from("yearbook_photos").select("path, thumb_path").eq("id", input.photoId).maybeSingle();
  const { error, count } = await supabase.from("yearbook_photos").delete({ count: "exact" }).eq("id", input.photoId);
  if (error) return { error: friendlyDbError(error) };
  if (!count) return { error: "Only the person who added it, or a coach, can remove it." };
  if (data) await supabase.storage.from(YEARBOOK_BUCKET).remove([data.path as string, data.thumb_path as string]);
  refresh();
  return { error: null };
}
