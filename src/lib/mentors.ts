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

const DAY = 86_400_000;
/** ISO weekday (1 = Monday ... 7 = Sunday) of a YYYY-MM-DD date. */
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
export const TRAINING_MAX_DAYS = 366;

/**
 * Training a mentor adds to her players' TWIS, tagged as from her: one day, or every week on
 * the days she picks (the start day's weekday if none) through an end date, up to a year.
 */
export function mentorTraining(
  input: { title?: unknown; date?: unknown; note?: unknown; repeat?: unknown; until?: unknown; days?: unknown },
  mentorName: string,
): { title: string; details: string; days: number[]; starts_on: string; ends_on: string; source: "mentor" } | { field: string; error: string } {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > DATE_TITLE_MAX) return { field: "title", error: "What is it? (a lesson, a bullpen, a hitting session...)" };
  const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
  if (!isDate(input.date)) return { field: "date", error: "Pick the day." };
  const date = input.date;
  const note = typeof input.note === "string" ? input.note.trim().slice(0, DATE_NOTE_MAX) : "";
  const details = [note, `From ${mentorName}`].filter(Boolean).join(" · ");
  if (input.repeat !== "weekly") return { title, details, days: [weekday(date)], starts_on: date, ends_on: date, source: "mentor" };

  if (!isDate(input.until)) return { field: "until", error: "Pick the last day it repeats." };
  const span = (Date.parse(`${input.until}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY;
  if (span < 0) return { field: "until", error: "The last day can't be before the first." };
  if (span > TRAINING_MAX_DAYS) return { field: "until", error: "Repeat it for a year at most." };
  const picked = (Array.isArray(input.days) ? input.days : [input.days])
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  const days = [...new Set(picked.length ? picked : [weekday(date)])].sort((a, b) => a - b);
  return { title, details, days, starts_on: date, ends_on: input.until, source: "mentor" };
}

// ---------------------------------------------------------------------------
// Asking to mentor, and working with the coaches
// ---------------------------------------------------------------------------

/** A request to mentor: the team code, and her name for one player (none = the whole team). */
export function cleanMentorRequest(input: { code?: unknown; scope?: unknown; player?: unknown }):
  | { code: string; playerName: string | null }
  | { field: string; error: string } {
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!code) return { field: "code", error: "Enter the team code from the coach or a parent." };
  if (input.scope !== "team" && input.scope !== "player") return { field: "scope", error: "Choose the whole team or one player." };
  if (input.scope === "team") return { code, playerName: null };
  const player = typeof input.player === "string" ? input.player.trim().replace(/\s+/g, " ") : "";
  if (!/\s/.test(player) || player.length > 80) return { field: "player", error: "Enter her first and last name, as the team has it." };
  return { code, playerName: player };
}

export const NOTE_MAX = 2000;
export const NOTE_KINDS = ["summary", "note"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const NOTE_KIND_LABEL: Record<NoteKind, string> = { summary: "Discussion summary", note: "Note" };

/** A note with the coaches: a discussion summary (with the day they talked) or a note. */
export function cleanMentorNote(input: { kind?: unknown; body?: unknown; discussedOn?: unknown }):
  | { kind: NoteKind; body: string; discussed_on: string | null }
  | { field: string; error: string } {
  const kind: NoteKind = input.kind === "summary" ? "summary" : "note";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body) return { field: "body", error: kind === "summary" ? "Write what you and the coaches talked about." : "Write the note." };
  if (body.length > NOTE_MAX) return { field: "body", error: `Keep it under ${NOTE_MAX} characters.` };
  const day = typeof input.discussedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.discussedOn) ? input.discussedOn : null;
  return { kind, body, discussed_on: kind === "summary" ? day : null };
}

export const FOCUS_STATUSES = ["working_on", "working"] as const;
export type FocusStatus = (typeof FOCUS_STATUSES)[number];
export const FOCUS_LABEL: Record<FocusStatus, string> = { working_on: "Working on", working: "What's working" };
export const isFocusStatus = (v: unknown): v is FocusStatus => FOCUS_STATUSES.includes(v as FocusStatus);

/** An area of focus: a short title and, if she likes, how she's working on it. */
export function cleanFocus(input: { title?: unknown; details?: unknown; status?: unknown }):
  | { title: string; details: string | null; status: FocusStatus }
  | { field: string; error: string } {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 120) return { field: "title", error: "Name the focus (up to 120 characters)." };
  const details = typeof input.details === "string" ? input.details.trim().slice(0, 500) : "";
  return { title, details: details || null, status: isFocusStatus(input.status) ? input.status : "working_on" };
}
