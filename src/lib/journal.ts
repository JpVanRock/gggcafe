// My Journal (user, 2026-11-12): a player's notes from her mentor sessions, typed and/or a
// voice memo recorded in the browser. Hers and her approved parents'; she can share an entry
// with the mentor it's about; coaches don't read it. The database checks the same limits
// (migration player_journal). No imports, so client components and unit tests can use it.

export const JOURNAL_BUCKET = "journal-audio";
export const JOURNAL_TOPIC_MAX = 120;
export const JOURNAL_NOTES_MAX = 5000;
export const JOURNAL_MENTOR_NAME_MAX = 80;
/** a voice memo stops itself after five minutes */
export const MEMO_MAX_SECONDS = 300;
/** the bucket's limit */
export const MEMO_MAX_BYTES = 10 * 1024 * 1024;

/** What the browser can record, best first (Chrome/Firefox: WebM or Ogg Opus; Safari: MP4/AAC). */
export const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"] as const;

/** The file type and extension a recording is saved with, from the recorder's MIME type. */
export function memoFileType(mime: string): { contentType: string; ext: "webm" | "m4a" | "ogg" } | null {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "audio/webm") return { contentType: "audio/webm", ext: "webm" };
  if (base === "audio/mp4" || base === "audio/x-m4a" || base === "audio/aac") return { contentType: "audio/mp4", ext: "m4a" };
  if (base === "audio/ogg") return { contentType: "audio/ogg", ext: "ogg" };
  return null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MEMO_PATH = new RegExp(`^(${UUID})/(${UUID})\\.(webm|m4a|ogg)$`);

/** A memo's place in the bucket: her folder, a new id. */
export function memoPath(playerId: string, fileId: string, ext: "webm" | "m4a" | "ogg") {
  return `${playerId}/${fileId}.${ext}`;
}

/** Is this a memo path in this player's folder? */
export function isMemoPathFor(path: string, playerId: string): boolean {
  const m = MEMO_PATH.exec(path);
  return Boolean(m && m[1] === playerId.toLowerCase());
}

/** "2:05" */
export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type JournalInput = {
  sessionDate: string;
  /** one of her mentors (a user id), "other" for someone not on the site, or "" */
  mentor: string;
  mentorName: string;
  topic: string;
  notes: string;
  audioPath: string | null;
  audioSeconds: number | null;
  shared: boolean;
};

export type JournalRow = {
  session_date: string;
  mentor_id: string | null;
  mentor_name: string | null;
  topic: string | null;
  notes: string | null;
  audio_path: string | null;
  audio_seconds: number | null;
  shared_with_mentor: boolean;
};

/**
 * Checks an entry from the form against her mentors (ids) and her folder. Returns the row to
 * save, or the field and the message to show.
 */
export function cleanJournalEntry(
  input: JournalInput,
  playerId: string,
  mentorIds: readonly string[],
  today: string,
): { row: JournalRow } | { field: string; error: string } {
  const date = input.sessionDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { field: "session_date", error: "Pick the day of the session." };
  if (date > today) return { field: "session_date", error: "The session can't be in the future." };
  const topic = input.topic.trim();
  const notes = input.notes.trim();
  if (topic.length > JOURNAL_TOPIC_MAX) return { field: "topic", error: `Keep the topic to ${JOURNAL_TOPIC_MAX} characters.` };
  if (notes.length > JOURNAL_NOTES_MAX) return { field: "notes", error: `Keep your notes to ${JOURNAL_NOTES_MAX} characters.` };
  const audio = input.audioPath?.trim() || null;
  if (audio && !isMemoPathFor(audio, playerId)) return { field: "audio", error: "That voice memo didn't save. Record it again." };
  const seconds = audio && input.audioSeconds ? Math.min(600, Math.max(1, Math.round(input.audioSeconds))) : null;
  if (!topic && !notes && !audio) return { field: "notes", error: "Write a note or record a voice memo first." };

  let mentorId: string | null = null;
  let mentorName: string | null = null;
  if (input.mentor === "other") {
    mentorName = input.mentorName.trim() || null;
    if (mentorName && mentorName.length > JOURNAL_MENTOR_NAME_MAX) return { field: "mentor_name", error: `Keep the name to ${JOURNAL_MENTOR_NAME_MAX} characters.` };
  } else if (input.mentor) {
    if (!mentorIds.includes(input.mentor)) return { field: "mentor", error: "Pick one of your mentors." };
    mentorId = input.mentor;
  }
  if (input.shared && !mentorId) return { field: "shared", error: "Pick the mentor to share it with." };

  return {
    row: {
      session_date: date,
      mentor_id: mentorId,
      mentor_name: mentorName,
      topic: topic || null,
      notes: notes || null,
      audio_path: audio,
      audio_seconds: seconds,
      shared_with_mentor: Boolean(input.shared && mentorId),
    },
  };
}
