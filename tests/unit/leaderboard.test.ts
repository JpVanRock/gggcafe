// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POINTS, SESSION_KINDS, cleanLog, currentRound, latestWinner, rankRows, weekRace, weekRange, type LeaderRow, type PotwWeek,
} from "../../src/lib/leaderboard.ts";

const row = (id: string, first: string, points: number, extra: Partial<LeaderRow> = {}): LeaderRow => ({
  player_id: id, jersey_number: null, first_name: first, last_name: first + "son",
  training: 0, workouts: 0, lessons: 0, unlocks: 0, points, week_points: 0, times_named: 0, last_named: null, ...extra,
});
const week = (week_start: string, player_id: string | null, round = 1): PotwWeek => ({ week_start, player_id, points: 10, round, first_name: null, last_name: null });

test("points match the user's system", () => {
  assert.deepEqual(POINTS, { unlock: 3, training: 3, workout: 5, lesson: 7 });
  assert.deepEqual(SESSION_KINDS.map((k) => `${k.kind}:${k.points}`), ["training:3", "workout:5", "lesson:7"]);
});

test("standings: most points first, ties share a rank", () => {
  const ranked = rankRows([row("a", "Ava", 10), row("b", "Bea", 30), row("c", "Cam", 10), row("d", "Dee", 5)]);
  assert.deepEqual(ranked.map((r) => `${r.first_name}:${r.rank}`), ["Bea:1", "Ava:2", "Cam:2", "Dee:4"]);
});

test("rounds: a new round starts once everyone has been named", () => {
  const rows = [row("a", "Ava", 0), row("b", "Bea", 0)];
  assert.equal(currentRound(rows, []).round, 1);
  const one = currentRound(rows, [week("2026-11-02", "a")]);
  assert.equal(one.round, 1);
  assert.ok(one.named.has("a"));
  const done = currentRound(rows, [week("2026-11-02", "a"), week("2026-11-09", "b")]);
  assert.equal(done.round, 2);
  assert.equal(done.named.size, 0);
});

test("this week's race: in the running first, then named this round, then waiting out six weeks", () => {
  const rows = [
    row("a", "Ava", 0, { week_points: 30, last_named: "2026-11-02" }), // named last week: cooldown
    row("b", "Bea", 0, { week_points: 12, last_named: "2026-09-21" }), // named seven weeks ago, this round
    row("c", "Cam", 0, { week_points: 8 }),
    row("d", "Dee", 0, { week_points: 15 }),
  ];
  const race = weekRace(rows, [week("2026-09-21", "b"), week("2026-11-02", "a")], "2026-11-09");
  assert.deepEqual(race.map((r) => `${r.first_name}:${r.status}`), ["Dee:eligible", "Cam:eligible", "Bea:named-this-round", "Ava:cooldown"]);
  assert.equal(race[3].until, "2026-12-14");
  // exactly six weeks later she's back
  const back = [row("a", "Ava", 0, { last_named: "2026-09-28" }), row("b", "Bea", 0)];
  assert.equal(weekRace(back, [week("2026-09-28", "a")], "2026-11-09").find((r) => r.first_name === "Ava")?.status, "named-this-round");
});

test("latest winner skips weeks nobody won", () => {
  assert.equal(latestWinner([week("2026-11-02", "a"), week("2026-11-09", null)])?.player_id, "a");
  assert.equal(latestWinner([week("2026-11-09", null)]), null);
});

test("week labels", () => {
  assert.equal(weekRange("2026-11-02"), "Nov 2 – 8");
  assert.equal(weekRange("2026-11-30"), "Nov 30 – Dec 6");
});

test("a session needs a kind and a day in the last week", () => {
  const today = "2026-11-08";
  assert.deepEqual(cleanLog({ kind: "lesson", date: "2026-11-07", note: "  Hitting lesson  " }, today), { kind: "lesson", date: "2026-11-07", note: "Hitting lesson" });
  assert.deepEqual(cleanLog({ kind: "workout", date: today }, today), { kind: "workout", date: today, note: null });
  assert.equal(typeof cleanLog({ kind: "nap", date: today }, today), "string");
  assert.equal(typeof cleanLog({ kind: "lesson", date: "2026-11-09" }, today), "string");
  assert.equal(typeof cleanLog({ kind: "lesson", date: "2026-10-31" }, today), "string");
  assert.equal(typeof cleanLog({ kind: "lesson", date: "2026-11-01" }, today), "object");
  assert.equal(typeof cleanLog({ kind: "lesson", date: "soon" }, today), "string");
});
