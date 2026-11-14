// Run with: npm run test:unit
// The job worker (docs/architecture/jobs.md): job kinds, payload checks and the parents' emails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { errorAlertEmail, isJobKind, jobPayload, videoCallEmail } from "../../src/lib/jobs/rules.ts";

const CALL = "e9e9e9e9-0000-4000-8000-0000000000ca";

test("job kinds match the database's enqueuers", () => {
  assert.ok(isJobKind("email.video_call"));
  assert.ok(isJobKind("zoom.delete_meeting"));
  assert.equal(isJobKind("email.unknown"), false);
});

test("payloads are checked before a handler runs", () => {
  assert.deepEqual(jobPayload("email.video_call", { call_id: CALL, event: "booked" }), { callId: CALL, event: "booked" });
  assert.equal(jobPayload("email.video_call", { call_id: CALL, event: "moved" }), null);
  assert.equal(jobPayload("email.video_call", { call_id: "not-a-uuid", event: "booked" }), null);
  assert.deepEqual(jobPayload("zoom.delete_meeting", { call_id: CALL, meeting_id: "81000000901" }), { callId: CALL, meetingId: "81000000901" });
  assert.equal(jobPayload("zoom.delete_meeting", { call_id: CALL, meeting_id: "81-bad" }), null);
  assert.equal(jobPayload("zoom.delete_meeting", null), null);
});

test("the parents' email: who, what, when, the family page; escaped in HTML", () => {
  const base = { player: "Avery", hostName: "Jess <Moreno>", hostKind: "mentor", topic: "Drop ball & release", when: "Tue, Nov 17 · 7:00 PM", minutes: 30, familyUrl: "https://gggcafe.vercel.app/family" };
  const booked = videoCallEmail({ ...base, cancelled: false });
  assert.equal(booked.subject, "Video call booked: Avery, Tue, Nov 17 · 7:00 PM");
  assert.match(booked.text, /Jess <Moreno> \(mentor\) booked a video call with Avery\./);
  assert.match(booked.text, /opens 10 minutes before it starts/);
  assert.match(booked.text, /https:\/\/gggcafe\.vercel\.app\/family/);
  assert.match(booked.html, /Jess &lt;Moreno&gt;/);
  assert.match(booked.html, /Drop ball &amp; release/);
  assert.doesNotMatch(booked.html, /<Moreno>/);
  const cancelled = videoCallEmail({ ...base, hostKind: "coach", cancelled: true });
  assert.equal(cancelled.subject, "Video call cancelled: Avery, Tue, Nov 17 · 7:00 PM");
  assert.match(cancelled.text, /\(head coach\) booked with Avery is cancelled/);
});

test("error alerts: a 16-hex fingerprint, and an email that links to Site health", () => {
  assert.equal(isJobKind("email.error_alert"), true);
  assert.deepEqual(jobPayload("email.error_alert", { fingerprint: "0123456789abcdef" }), { fingerprint: "0123456789abcdef" });
  assert.equal(jobPayload("email.error_alert", { fingerprint: "NOT-HEX" }), null);
  assert.equal(jobPayload("email.error_alert", { call_id: "x" }), null);
  const email = errorAlertEmail({ source: "server", name: "TypeError", message: "Cannot read <b>", route: "/players/[id]", count: 1, healthUrl: "https://www.ggg.cafe/health" });
  assert.equal(email.subject, "New error on GGG.Cafe: TypeError");
  assert.match(email.text, /Seen 1 time so far/);
  assert.match(email.text, /https:\/\/www\.ggg\.cafe\/health$/);
  assert.match(email.html, /Cannot read &lt;b&gt;/);
  assert.match(email.html, /href="https:\/\/www\.ggg\.cafe\/health"/);
});

test("a group call's email names her and how many others", () => {
  const base = { player: "Maya", hostName: "Pat", hostKind: "mentor", topic: "Bunting", when: "Tue, Nov 17 · 7:00 PM", minutes: 30, cancelled: false, familyUrl: "https://www.ggg.cafe/family" };
  assert.match(videoCallEmail({ ...base, others: 2 }).text, /Pat \(mentor\) booked a group video call with Maya and 2 other players\./);
  assert.match(videoCallEmail({ ...base, others: 1 }).text, /with Maya and 1 other player\./);
  assert.match(videoCallEmail(base).text, /booked a video call with Maya\./);
  assert.match(videoCallEmail({ ...base, cancelled: true, others: 1 }).text, /The group video call Pat \(mentor\) booked with Maya and 1 other player is cancelled\./);
});
