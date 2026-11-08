// Mentors (mentors, pitching/hitting coaches...): what they can send a player.
// Checks run on the server before the database checks again. No imports, so it
// runs in unit tests (npm run test:unit).

export const MESSAGE_MAX = 2000;
export const MESSAGE_PHOTO_BUCKET = "message-photos";
export const DATE_TITLE_MAX = 120;
export const DATE_NOTE_MAX = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A message: text, a photo she uploaded to her own folder, and/or a suggested drill. */
export function cleanMessage(
  input: { body?: unknown; photoPath?: unknown; drillId?: unknown },
  senderId: string,
): { body: string | null; photoPath: string | null; drillId: string | null } | string {
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body.length > MESSAGE_MAX) return `Keep it under ${MESSAGE_MAX} characters.`;
  const photoPath = typeof input.photoPath === "string" && input.photoPath ? input.photoPath : null;
  if (photoPath && !new RegExp(`^${senderId}/[0-9]{10,16}\\.jpg$`).test(photoPath)) return "That photo didn't upload right. Try it again.";
  const drillId = typeof input.drillId === "string" && input.drillId ? input.drillId : null;
  if (drillId && !UUID.test(drillId)) return "Pick a drill from the library.";
  if (!body && !photoPath && !drillId) return "Write a message, add a photo or pick a drill.";
  return { body: body || null, photoPath, drillId };
}

/** A new drill for the Drill Library: a name, and optionally a video link (https) and how to run it. */
export function cleanNewDrill(input: { name?: unknown; videoUrl?: unknown; description?: unknown }):
  | { name: string; video_url: string | null; description: string | null }
  | string {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) return "Give the drill a name (up to 120 characters).";
  const video = typeof input.videoUrl === "string" ? input.videoUrl.trim() : "";
  if (video && !/^https:\/\/\S+$/.test(video)) return "The video link has to start with https://";
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 2000) : "";
  return { name, video_url: video || null, description: description || null };
}

/** A date a mentor adds to her player's TWIS: that day only, tagged as from her mentor. */
export function mentorDate(
  input: { title?: unknown; date?: unknown; note?: unknown },
  mentorName: string,
): { title: string; details: string; days: number[]; starts_on: string; ends_on: string; source: "mentor" } | string {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > DATE_TITLE_MAX) return "What is it? (a lesson, a bullpen, a call...)";
  const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  if (!date) return "Pick the day.";
  const note = typeof input.note === "string" ? input.note.trim().slice(0, DATE_NOTE_MAX) : "";
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7; // ISO: 1 = Monday ... 7 = Sunday
  return {
    title,
    details: [note, `From ${mentorName}`].filter(Boolean).join(" · "),
    days: [weekday],
    starts_on: date,
    ends_on: date,
    source: "mentor",
  };
}
