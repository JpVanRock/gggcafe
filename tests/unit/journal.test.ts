// Run with: npm run test:unit
// My Journal (user, 2026-11-12): her notes and voice memos from mentor sessions.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOURNAL_NOTES_MAX, MEMO_MAX_SECONDS, RECORDING_TYPES, cleanJournalEntry, formatSeconds, isMemoPathFor, memoFileType, memoPath,
  type JournalInput,
} from "../../src/lib/journal.ts";

const PLAYER = "11111111-2222-4333-8444-555555555555";
const MENTOR = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const FILE = "99999999-8888-4777-8666-555555555555";
const base: JournalInput = { sessionDate: "2026-11-10", mentor: MENTOR, mentorName: "", topic: "Drop ball", notes: "Spin it.", audioPath: null, audioSeconds: null, shared: false };
const clean = (patch: Partial<JournalInput>) => cleanJournalEntry({ ...base, ...patch }, PLAYER, [MENTOR], "2026-11-12");

test("memo files: the recorder's type becomes a type the bucket allows, with its extension", () => {
  assert.deepEqual(memoFileType("audio/webm;codecs=opus"), { contentType: "audio/webm", ext: "webm" });
  assert.deepEqual(memoFileType("audio/mp4"), { contentType: "audio/mp4", ext: "m4a" });
  assert.deepEqual(memoFileType("audio/ogg; codecs=opus"), { contentType: "audio/ogg", ext: "ogg" });
  assert.equal(memoFileType("video/webm"), null);
  for (const t of RECORDING_TYPES) assert.ok(memoFileType(t), t);
});

test("memo paths live in her own folder", () => {
  const path = memoPath(PLAYER, FILE, "webm");
  assert.equal(path, `${PLAYER}/${FILE}.webm`);
  assert.ok(isMemoPathFor(path, PLAYER));
  assert.ok(!isMemoPathFor(path, MENTOR), "someone else's folder");
  assert.ok(!isMemoPathFor(`${PLAYER}/${FILE}.mp3`, PLAYER), "a type we don't record");
  assert.ok(!isMemoPathFor(`${PLAYER}/../${FILE}.webm`, PLAYER));
});

test("formatSeconds", () => {
  assert.equal(formatSeconds(0), "0:00");
  assert.equal(formatSeconds(65), "1:05");
  assert.equal(formatSeconds(MEMO_MAX_SECONDS), "5:00");
});

test("an entry with one of her mentors, shared", () => {
  assert.deepEqual(clean({ shared: true }), {
    row: { session_date: "2026-11-10", mentor_id: MENTOR, mentor_name: null, topic: "Drop ball", notes: "Spin it.", audio_path: null, audio_seconds: null, shared_with_mentor: true },
  });
});

test("someone else (not on the site) can't be shared with; no mentor is fine", () => {
  assert.deepEqual(clean({ mentor: "other", mentorName: " Hitting lesson ", shared: true }), { field: "shared", error: "Pick the mentor to share it with." });
  const other = clean({ mentor: "other", mentorName: " Hitting lesson " });
  assert.ok("row" in other && other.row.mentor_name === "Hitting lesson" && other.row.mentor_id === null);
  const none = clean({ mentor: "" });
  assert.ok("row" in none && none.row.mentor_id === null && none.row.mentor_name === null);
});

test("only her own mentors, a real past day, and something written or recorded", () => {
  assert.deepEqual(clean({ mentor: "cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee" }), { field: "mentor", error: "Pick one of your mentors." });
  assert.deepEqual(clean({ sessionDate: "2026-11-13" }), { field: "session_date", error: "The session can't be in the future." });
  assert.deepEqual(clean({ sessionDate: "Nov 10" }), { field: "session_date", error: "Pick the day of the session." });
  assert.deepEqual(clean({ topic: " ", notes: "" }), { field: "notes", error: "Write a note or record a voice memo first." });
  assert.equal((clean({ notes: "x".repeat(JOURNAL_NOTES_MAX + 1) }) as { field: string }).field, "notes");
});

test("a voice memo alone is an entry; a memo from another folder isn't kept", () => {
  const memo = clean({ topic: "", notes: "", audioPath: memoPath(PLAYER, FILE, "m4a"), audioSeconds: 42.4 });
  assert.ok("row" in memo && memo.row.audio_path?.endsWith(".m4a") && memo.row.audio_seconds === 42 && memo.row.topic === null);
  assert.deepEqual(clean({ audioPath: memoPath(MENTOR, FILE, "webm") }), { field: "audio", error: "That voice memo didn't save. Record it again." });
});
