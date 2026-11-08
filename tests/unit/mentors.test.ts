// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMessage, cleanNewDrill, mentorDate } from "../../src/lib/mentors.ts";

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

test("a mentor's date is one day in her TWIS, marked as from the mentor", () => {
  const d = mentorDate({ title: "Pitching lesson", date: "2027-01-05", note: "Bring your glove" }, "Pat Pitching");
  assert.ok(typeof d === "object");
  assert.deepEqual([d.days, d.starts_on, d.ends_on, d.source, d.details], [[2], "2027-01-05", "2027-01-05", "mentor", "Bring your glove · From Pat Pitching"]);
  assert.equal(typeof mentorDate({ title: "", date: "2027-01-05" }, "Pat"), "string");
  assert.equal(typeof mentorDate({ title: "Lesson", date: "soon" }, "Pat"), "string");
});
