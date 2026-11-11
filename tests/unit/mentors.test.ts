// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFocus, cleanMentorNote, cleanMentorRequest, cleanMessage, cleanNewDrill, mentorTraining } from "../../src/lib/mentors.ts";

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
