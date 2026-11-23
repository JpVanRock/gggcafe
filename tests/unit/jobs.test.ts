// Run with: npm run test:unit
// The job worker (docs/architecture/jobs.md): job kinds, payload checks and the parents' emails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { errorAlertEmail, isJobKind, jobPayload, mentorCallEmail, mentorMessageEmail, videoCallEmail } from "../../src/lib/jobs/rules.ts";

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

test("an invited mentor's email: who invited them, with whom, and the call page (user, 2026-11-22)", () => {
  const base = {
    mentor: "Dana <Ortiz>",
    player: "Emma",
    others: 0,
    hostName: "Pat Torres",
    topic: "Winter plan",
    when: "Thu, Jan 14 · 6:30 PM",
    minutes: 45,
    cancelled: false,
    callUrl: "https://www.ggg.cafe/calls/abc",
    mentorUrl: "https://www.ggg.cafe/mentor",
  };
  const booked = mentorCallEmail(base);
  assert.equal(booked.subject, "Video call invite: Emma, Thu, Jan 14 · 6:30 PM");
  assert.match(booked.text, /Pat Torres \(head coach\) invited you to a video call with Emma\./);
  assert.match(booked.text, /When: Thu, Jan 14 · 6:30 PM \(45 minutes\)/);
  assert.match(booked.text, /https:\/\/www\.ggg\.cafe\/calls\/abc$/);
  assert.match(booked.html, /Hi Dana &lt;Ortiz&gt;,/);
  assert.match(booked.html, /<a href="https:\/\/www\.ggg\.cafe\/calls\/abc">Open the call page<\/a>/);
  assert.match(mentorCallEmail({ ...base, others: 2 }).text, /a group video call with Emma and 2 other players\./);
  const cancelled = mentorCallEmail({ ...base, cancelled: true });
  assert.equal(cancelled.subject, "Video call cancelled: Thu, Jan 14 · 6:30 PM");
  assert.match(cancelled.text, /The video call with Emma that Pat Torres \(head coach\) invited you to is cancelled\./);
  assert.match(cancelled.html, /Open your mentor home/);
});

test("the parents' conversation with a mentor is emailed both ways (user, 2026-11-23)", () => {
  assert.ok(isJobKind("email.mentor_message"));
  assert.deepEqual(jobPayload("email.mentor_message", { message_id: CALL }), { messageId: CALL });
  assert.equal(jobPayload("email.mentor_message", { message_id: "nope" }), null);
  assert.equal(jobPayload("email.mentor_message", { call_id: CALL }), null);
  const base = { authorName: "Jo <Kim>", mentorName: "Pat Pitching", player: "Jordan", body: "Good week.\nNext: a target & more reps.", url: "https://www.ggg.cafe/family/mentors?player=x" };
  const toParents = mentorMessageEmail({ ...base, toParents: true });
  assert.equal(toParents.subject, "Pat Pitching wrote to you about Jordan");
  assert.match(toParents.text, /^Pat Pitching, Jordan's mentor, wrote to you on GGG\.Cafe:\n\nGood week\.\nNext: a target & more reps\./);
  assert.match(toParents.text, /Jordan doesn't see your conversation with her mentor\. Replies to this email aren't read\./);
  assert.match(toParents.html, /Good week\.<br>Next: a target &amp; more reps\./);
  assert.match(toParents.html, /Open the family page/);
  const toMentor = mentorMessageEmail({ ...base, toParents: false, url: "https://www.ggg.cafe/mentor/messages?player=x&with=parents" });
  assert.equal(toMentor.subject, "Jo <Kim> (Jordan's parent) wrote to you");
  assert.match(toMentor.text, /^Hi Pat Pitching,\n\nJo <Kim>, Jordan's parent, wrote to you/);
  assert.match(toMentor.html, /Jo &lt;Kim&gt;, Jordan&#39;s parent/);
  assert.match(toMentor.html, /href="https:\/\/www\.ggg\.cafe\/mentor\/messages\?player=x&amp;with=parents"/);
});
