// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { MESSAGE_MAX, cleanFocus, cleanMentorNote, cleanMentorRequest, cleanMessage, cleanNewDrill, cleanText, mentorTraining, threadSummaries, trainingDates } from "../../src/lib/mentors.ts";

test("training on the mentor's calendar: its weekdays, inside the month shown", () => {
  // Tuesdays and Thursdays (2, 4) from Tue Nov 3 through Thu Nov 26, 2026
  const weekly = { days: [2, 4], starts_on: "2026-11-03", ends_on: "2026-11-26" };
  assert.deepEqual(trainingDates(weekly, "2026-10-26", "2026-12-06"), [
    "2026-11-03", "2026-11-05", "2026-11-10", "2026-11-12", "2026-11-17", "2026-11-19", "2026-11-24", "2026-11-26",
  ]);
  assert.deepEqual(trainingDates(weekly, "2026-11-11", "2026-11-18"), ["2026-11-12", "2026-11-17"]);
  assert.deepEqual(trainingDates(weekly, "2026-12-01", "2026-12-31"), []);
  // one day (as mentorTraining saves it)
  const once = mentorTraining({ title: "Bullpen", date: "2026-11-14" }, "Coach K");
  assert.ok(!("error" in once));
  assert.deepEqual(trainingDates(once, "2026-11-01", "2026-11-30"), ["2026-11-14"]);
  assert.deepEqual(trainingDates({ days: [6], starts_on: "2026-11-14", ends_on: null }, "2026-11-01", "2026-11-30"), ["2026-11-14"]);
});

const me = "cccccccc-0000-0000-0000-000000000001";

test("a message needs text, a photo or a drill; the photo must be in her own folder", () => {
  assert.deepEqual(cleanMessage({ body: "  Great pen today  " }, me), { body: "Great pen today", photoPath: null, drillId: null });
  assert.deepEqual(cleanMessage({ photoPath: `${me}/1762600000000.jpg` }, me), { body: null, photoPath: `${me}/1762600000000.jpg`, drillId: null });
  assert.equal(typeof cleanMessage({ photoPath: "someone-else/1762600000000.jpg" }, me), "string");
  assert.equal(typeof cleanMessage({ body: "   " }, me), "string");
  assert.equal(typeof cleanMessage({ drillId: "not-a-uuid" }, me), "string");
  assert.equal(typeof cleanMessage({ body: "x".repeat(2001) }, me), "string");
});

test("a new drill needs a name; the video link must be https", () => {
  assert.deepEqual(cleanNewDrill({ name: " Towel drill ", videoUrl: "https://youtu.be/x", description: "" }), {
    name: "Towel drill",
    video_url: "https://youtu.be/x",
    description: null,
  });
  assert.equal(typeof cleanNewDrill({ name: "" }), "string");
  assert.equal(typeof cleanNewDrill({ name: "Drill", videoUrl: "http://insecure" }), "string");
});

test("mentor training: one day, or every week through an end date, marked as from the mentor", () => {
  const d = mentorTraining({ title: "Pitching lesson", date: "2027-01-05", note: "Bring your glove" }, "Pat Pitching");
  assert.ok("source" in d);
  assert.deepEqual([d.days, d.starts_on, d.ends_on, d.source, d.details], [[2], "2027-01-05", "2027-01-05", "mentor", "Bring your glove · From Pat Pitching"]);
  const w = mentorTraining({ title: "Hitting", date: "2027-01-05", repeat: "weekly", until: "2027-02-25", days: ["4", "2", "2"] }, "Pat");
  assert.ok("source" in w);
  assert.deepEqual([w.days, w.starts_on, w.ends_on], [[2, 4], "2027-01-05", "2027-02-25"]);
  const one = mentorTraining({ title: "Hitting", date: "2027-01-05", repeat: "weekly", until: "2027-01-26" }, "Pat");
  assert.ok("source" in one);
  assert.deepEqual(one.days, [2], "no days picked: the first day's weekday");
  const err = (x: object) => ("field" in x ? x.field : null);
  assert.equal(err(mentorTraining({ title: "", date: "2027-01-05" }, "Pat")), "title");
  assert.equal(err(mentorTraining({ title: "Lesson", date: "soon" }, "Pat")), "date");
  assert.equal(err(mentorTraining({ title: "Lesson", date: "2027-01-05", repeat: "weekly" }, "Pat")), "until");
  assert.equal(err(mentorTraining({ title: "Lesson", date: "2027-01-05", repeat: "weekly", until: "2027-01-01" }, "Pat")), "until");
  assert.equal(err(mentorTraining({ title: "Lesson", date: "2027-01-05", repeat: "weekly", until: "2028-03-01" }, "Pat")), "until");
});

test("asking to mentor: the team code, and one player's full name or the whole team", () => {
  assert.deepEqual(cleanMentorRequest({ code: " ggg234 ", scope: "team", player: "ignored" }), { code: "ggg234", playerName: null });
  assert.deepEqual(cleanMentorRequest({ code: "GGG234", scope: "player", player: "  Lila   Park " }), { code: "GGG234", playerName: "Lila Park" });
  assert.equal((cleanMentorRequest({ code: "", scope: "team" }) as { field: string }).field, "code");
  assert.equal((cleanMentorRequest({ code: "GGG234" }) as { field: string }).field, "scope");
  assert.equal((cleanMentorRequest({ code: "GGG234", scope: "player", player: "Lila" }) as { field: string }).field, "player");
});

test("notes with the coaches and focus areas", () => {
  assert.deepEqual(cleanMentorNote({ kind: "summary", body: " Talked about her drop ball ", discussedOn: "2026-11-10" }), {
    kind: "summary", body: "Talked about her drop ball", discussed_on: "2026-11-10",
  });
  assert.deepEqual(cleanMentorNote({ kind: "reply?", body: "Agreed", discussedOn: "2026-11-10" }), { kind: "note", body: "Agreed", discussed_on: null });
  assert.equal((cleanMentorNote({ body: "  " }) as { field: string }).field, "body");
  assert.equal((cleanMentorNote({ body: "x".repeat(2001) }) as { field: string }).field, "body");
  assert.deepEqual(cleanFocus({ title: " Drive the drop ball ", details: "" }), { title: "Drive the drop ball", details: null, status: "working_on" });
  assert.equal(cleanFocus({ title: "Hips first", status: "working" }).status, "working");
  assert.equal((cleanFocus({ title: "" }) as { field: string }).field, "title");
});

test("conversations (user, 2026-11-23): text is required and capped", () => {
  assert.deepEqual(cleanText("  Thanks, coach!  "), { body: "Thanks, coach!" });
  assert.equal(cleanText("   "), "Write something first.");
  assert.equal(cleanText(undefined), "Write something first.");
  assert.equal(cleanText("x".repeat(MESSAGE_MAX + 1)), `Keep it under ${MESSAGE_MAX} characters.`);
});

test("conversations: one per mentor, player and audience, newest first, counting what's new for the viewer", () => {
  const msg = (id: string, mentor: string, audience: "player" | "parents", author_role: string, created_at: string, read_at: string | null = null) => ({
    id, mentor_id: mentor, player_id: "p1", audience, author_role, created_at, read_at,
  });
  const rows = [
    msg("a", "m1", "player", "mentor", "2026-11-20T10:00:00Z", "2026-11-20T11:00:00Z"),
    msg("b", "m1", "player", "player", "2026-11-21T10:00:00Z"),
    msg("c", "m1", "parents", "mentor", "2026-11-22T10:00:00Z"),
    msg("d", "m1", "parents", "parent", "2026-11-23T10:00:00Z", "2026-11-23T12:00:00Z"),
    msg("e", "m2", "player", "player", "2026-11-19T10:00:00Z"),
  ];
  // the mentor's view: answers she hasn't read are new; her own messages never are
  const forMentor = threadSummaries(rows, (m) => m.author_role === "mentor");
  assert.deepEqual(forMentor.map((t) => [t.key, t.last.id, t.unread, t.count]), [
    ["m1:p1:parents", "d", 0, 2],
    ["m1:p1:player", "b", 1, 2],
    ["m2:p1:player", "e", 1, 1],
  ]);
  // the player's view of her thread with m1: the mentor's message was read, her own answer doesn't count
  const forPlayer = threadSummaries(rows.filter((m) => m.audience === "player"), (m) => m.author_role === "player");
  assert.deepEqual(forPlayer.map((t) => [t.key, t.unread]), [["m1:p1:player", 0], ["m2:p1:player", 0]]);
});
