// Team Yearbook (G3 Advanced): the season's photos laid out like a yearbook,
// month by month, or as thumbnails, searchable by tagged player. Data comes from
// public.team_yearbook(). No imports, so it runs in unit tests.

export const YEARBOOK_BUCKET = "yearbook-photos";
export const CAPTION_MAX = 300;
export const FULL_SIDE = 1600; // px, the photo
export const THUMB_SIDE = 480; // px, the thumbnail

export type YearbookAccess = "manage" | "add" | "view";
export type YearbookTag = { player_id: string; name: string };
export type YearbookPhoto = {
  id: string;
  path: string;
  thumb_path: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  taken_on: string | null;
  created_at: string;
  uploader_name: string;
  mine: boolean;
  tags: YearbookTag[];
};
export type YearbookData = {
  access: YearbookAccess;
  team: { id: string; name: string; logo_url: string | null };
  season: { id: string; name: string } | null;
  seasons: { id: string; name: string; photos: number }[];
  roster: { player_id: string; name: string; jersey: string | null }[];
  photos: YearbookPhoto[];
};

/** The day a photo belongs to: the day it was taken, else the day it was added. */
export function photoDay(p: Pick<YearbookPhoto, "taken_on" | "created_at">) {
  return p.taken_on ?? p.created_at.slice(0, 10);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The yearbook's chapters: one per month, newest first, photos newest first. */
export function monthSpreads(photos: YearbookPhoto[]) {
  const byMonth = new Map<string, YearbookPhoto[]>();
  for (const p of [...photos].sort((a, b) => photoDay(b).localeCompare(photoDay(a)) || b.created_at.localeCompare(a.created_at))) {
    const key = photoDay(p).slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), p]);
  }
  return [...byMonth.entries()].map(([key, list]) => ({
    key,
    month: MONTHS[Number(key.slice(5, 7)) - 1],
    year: key.slice(0, 4),
    photos: list,
  }));
}

/**
 * The magazine layout of a spread: tile i's size. The first photo is the feature
 * (big), then a rhythm of wide and regular tiles, so every month looks different.
 */
export function tileSize(i: number, count: number): "feature" | "wide" | "tall" | "regular" {
  if (i === 0 && count > 2) return "feature";
  const n = i % 7;
  if (n === 3) return "wide";
  if (n === 5) return "tall";
  return "regular";
}

/** Photos with a player tagged (search by player); all of them with no player picked. */
export function photosOf(photos: YearbookPhoto[], playerId: string | null) {
  return playerId ? photos.filter((p) => p.tags.some((t) => t.player_id === playerId)) : photos;
}

/** How many photos each player is in, for the search list ("Avery · 12"). */
export function tagCounts(photos: YearbookPhoto[]) {
  const counts = new Map<string, number>();
  for (const p of photos) for (const t of p.tags) counts.set(t.player_id, (counts.get(t.player_id) ?? 0) + 1);
  return counts;
}

/** Storage paths for a new photo and its thumbnail: <team>/<season>/<timestamp>-<random>.jpg. */
export function photoPaths(teamId: string, seasonId: string, stamp: number, random: string) {
  const base = `${teamId}/${seasonId}/${stamp}-${random.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12).padEnd(4, "0")}`;
  return { path: `${base}.jpg`, thumb_path: `${base}_t.jpg` };
}

/** A caption: trimmed, short. */
export function cleanCaption(v: unknown) {
  return typeof v === "string" ? v.trim().slice(0, CAPTION_MAX) || null : null;
}
