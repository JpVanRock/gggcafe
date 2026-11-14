// Run with: npm run test:unit
// Video calls (user, 2026-11-12): when a call opens, booking rules, and the Zoom join signature.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  BOOK_AHEAD_DAYS, CALL_MINUTES, TOPIC_MAX, callDateAndClock, callEnds, callState, cleanCallInput, comingSinceISO, formatCallTime, isComing,
} from "../../src/lib/video-calls.ts";

test("a call's day and clock in the team's time zone (the mentor's calendar)", () => {
  // 00:30 UTC on the 18th is 7:30 PM on the 17th in New York
  assert.deepEqual(callDateAndClock("2026-11-18T00:30:00Z", "America/New_York"), { date: "2026-11-17", clock: "19:30" });
  assert.deepEqual(callDateAndClock("2026-11-18T00:30:00Z", "UTC"), { date: "2026-11-18", clock: "00:30" });
  assert.deepEqual(callDateAndClock("2026-07-04T16:05:00Z", "America/Los_Angeles"), { date: "2026-07-04", clock: "09:05" });
});
import { meetingSdkSignature } from "../../src/lib/zoom-signature.ts";

const now = new Date("2026-11-20T23:00:00Z");
const at = (minutesFromNow: number) => new Date(now.getTime() + minutesFromNow * 60_000).toISOString();

test("a call opens 10 minutes early and stays open 15 minutes past its end", () => {
  const call = { starts_at: at(30), minutes: 30, cancelled_at: null };
  assert.equal(callState(call, now), "upcoming");
  assert.equal(callState({ ...call, starts_at: at(10) }, now), "open");
  assert.equal(callState({ ...call, starts_at: at(-44) }, now), "open");
  assert.equal(callState({ ...call, starts_at: at(-46) }, now), "over");
  assert.equal(callState({ ...call, cancelled_at: at(-5) }, now), "cancelled");
  assert.equal(callEnds(call).toISOString(), at(60));
  assert.equal(isComing(call, now), true);
  assert.equal(isComing({ ...call, starts_at: at(-46) }, now), false);
  // the "still ahead" queries reach back far enough for the longest call
  assert.ok(new Date(comingSinceISO(now)).getTime() <= now.getTime() - (Math.max(...CALL_MINUTES) + 15) * 60_000);
});

test("booking: a time ahead (up to 90 days), a length from the list and a topic", () => {
  const good = cleanCallInput({ startsAt: at(60), minutes: "45", topic: "  Drop ball:   the release " }, now);
  assert.deepEqual(good, { ok: true, call: { startsAt: at(60), minutes: 45, topic: "Drop ball: the release" } });
  assert.deepEqual(cleanCallInput({ startsAt: "", minutes: "30", topic: "x" }, now), { ok: false, field: "starts_at", error: "Pick the day and time." });
  assert.equal(cleanCallInput({ startsAt: at(2), minutes: "30", topic: "x" }, now).ok, false);
  assert.equal(cleanCallInput({ startsAt: at((BOOK_AHEAD_DAYS + 1) * 24 * 60), minutes: "30", topic: "x" }, now).ok, false);
  assert.deepEqual(cleanCallInput({ startsAt: at(60), minutes: "20", topic: "x" }, now), { ok: false, field: "minutes", error: "Pick how long the call is." });
  assert.equal(cleanCallInput({ startsAt: at(60), minutes: "30", topic: " " }, now).ok, false);
  assert.equal(cleanCallInput({ startsAt: at(60), minutes: "30", topic: "x".repeat(TOPIC_MAX + 1) }, now).ok, false);
});

test("call times read in the team's time zone", () => {
  assert.equal(formatCallTime("2026-11-21T00:00:00Z", "America/New_York"), "Fri, Nov 20 · 7:00 PM");
});

test("the Meeting SDK signature: HS256 over the app key, meeting, role and two hours", () => {
  const jwt = meetingSdkSignature({ sdkKey: "key123", sdkSecret: "secret456", meetingNumber: "81000000101", role: 1, now: 1_800_000_000 });
  const [header, payload, signature] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "HS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.equal(claims.appKey, "key123");
  assert.equal(claims.mn, "81000000101");
  assert.equal(claims.role, 1);
  assert.equal(claims.iat, 1_800_000_000 - 30);
  assert.equal(claims.exp - claims.iat, 2 * 60 * 60);
  assert.equal(claims.tokenExp, claims.exp);
  assert.equal(signature, createHmac("sha256", "secret456").update(`${header}.${payload}`).digest("base64url"));
});
