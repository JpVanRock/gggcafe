// Run with: npm run test:unit
// The Mental GP lessons (players) and the coaches' Mental Game course (user, 2026-11-12).
import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIDED_SESSIONS, SCAN_SKILLS } from "../../src/lib/mental.ts";
import { CHAPTERS } from "../../src/lib/advanced-book.ts";
import { MENTAL_FIELDS } from "../../src/app/(staff)/players/[playerId]/shared.ts";
import {
  LESSON_ANSWER_MAX, MENTAL_LESSONS, lessonBySlug, lessonNeighbors, lessonNumber, lessonsDone, nextLesson, twoDigits,
} from "../../src/lib/mental-lessons.ts";
import { COACH_MODULES, COACH_NOTES_MAX, moduleBySlug, moduleNeighbors, moduleNumber, modulesDone } from "../../src/lib/coach-training.ts";

// the database's check on player_mental_lessons.lesson and coach_mental_lessons.lesson
const SLUG = /^[a-z0-9-]{1,40}$/;

test("player lessons: eight, unique slugs the database accepts, every part filled in", () => {
  assert.equal(MENTAL_LESSONS.length, 8);
  assert.equal(new Set(MENTAL_LESSONS.map((l) => l.slug)).size, MENTAL_LESSONS.length);
  for (const l of MENTAL_LESSONS) {
    assert.match(l.slug, SLUG, l.slug);
    assert.ok(l.title && l.summary && l.rep && l.lockIn && l.reflect.prompt && l.reflect.hint, l.slug);
    assert.ok(l.idea.length >= 2, `${l.slug}: the idea`);
    assert.ok(l.steps.length >= 3, `${l.slug}: steps`);
    assert.ok(l.minutes >= 3 && l.minutes <= 10, `${l.slug}: minutes`);
    assert.ok(l.tools.length >= 1, `${l.slug}: tools`);
    if (l.situations) assert.ok(l.situations.heading && l.situations.items.length >= 2, `${l.slug}: situations`);
  }
  assert.equal(LESSON_ANSWER_MAX, 1500);
});

test("player lessons point only to tools that exist", () => {
  const sessions = new Set(GUIDED_SESSIONS.map((s) => s.slug));
  for (const l of MENTAL_LESSONS) {
    for (const t of l.tools) {
      if (t.startsWith("session:")) assert.ok(sessions.has(t.slice(8)), `${l.slug}: no guided session ${t}`);
      else assert.ok(["signals", "intensity", "scan", "journal"].includes(t), `${l.slug}: unknown tool ${t}`);
    }
  }
});

test("plan-field lessons save to real Mental Game Plan fields, one lesson per field", () => {
  const fields = new Set<string>(MENTAL_FIELDS.map((f) => f.name));
  const used = MENTAL_LESSONS.flatMap((l) => (l.planField ? [l.planField] : []));
  for (const f of used) assert.ok(fields.has(f), `no plan field ${f}`);
  assert.equal(new Set(used).size, used.length, "two lessons write the same plan field");
  assert.deepEqual(
    MENTAL_LESSONS.filter((l) => l.planField).map((l) => l.slug),
    ["between-pitches", "pressure-at-bats", "after-the-error", "game-day"],
  );
});

test("every self-scan skill has a lesson that builds it, and lessons name only real skills", () => {
  const keys = new Set(SCAN_SKILLS.map((s) => s.key));
  for (const l of MENTAL_LESSONS) {
    assert.ok(l.skills.length >= 1, `${l.slug}: skills`);
    for (const k of l.skills) assert.ok(keys.has(k), `${l.slug}: no self-scan skill ${k}`);
  }
  for (const k of keys) assert.ok(MENTAL_LESSONS.some((l) => l.skills.includes(k)), `no lesson builds ${k}`);
});

test("Go deeper points to written G3 Advanced chapters", () => {
  const ready = new Set(CHAPTERS.filter((c) => c.status === "ready").map((c) => c.slug));
  for (const l of MENTAL_LESSONS) {
    for (const c of l.deeper) assert.ok(ready.has(c), `${l.slug}: no written chapter ${c}`);
  }
});

test("lessons don't reuse G3 Advanced titles", () => {
  const paid = new Set<string>();
  for (const c of CHAPTERS) {
    paid.add(c.title.toLowerCase());
    for (const step of c.course ?? []) paid.add(step.title.toLowerCase());
  }
  for (const l of MENTAL_LESSONS) assert.ok(!paid.has(l.title.toLowerCase()), l.title);
});

test("up next: the weakest skill's first open lesson, else the next in order", () => {
  assert.equal(nextLesson([])?.lesson.slug, "between-pitches");
  assert.equal(nextLesson([])?.skill, null);
  assert.deepEqual(nextLesson([], ["reset"]), { lesson: lessonBySlug("after-the-error"), skill: "reset" });
  // her weakest skill's lessons are done: the next weakest decides
  assert.equal(nextLesson(["after-the-error"], ["reset", "preparation"])?.lesson.slug, "game-day");
  // nothing open for any weak skill: next in order
  assert.equal(nextLesson(["after-the-error"], ["reset"])?.lesson.slug, "between-pitches");
  assert.equal(nextLesson(MENTAL_LESSONS.map((l) => l.slug)), null);
});

test("player lessons: lookups, numbers, neighbors and counts", () => {
  assert.equal(lessonBySlug("nerves")?.title, "Nerves Mean You're Ready");
  assert.equal(lessonBySlug("nope"), undefined);
  assert.equal(lessonNumber("between-pitches"), 1);
  assert.equal(lessonNumber("nope"), 0);
  assert.equal(lessonNeighbors("between-pitches").prev, null);
  assert.equal(lessonNeighbors("between-pitches").next?.slug, MENTAL_LESSONS[1].slug);
  assert.equal(lessonNeighbors(MENTAL_LESSONS.at(-1)!.slug).next, null);
  assert.deepEqual(lessonNeighbors("nope"), { prev: null, next: null });
  assert.equal(lessonsDone(["nerves", "nerves", "slumps", "not-a-lesson"]), 2);
  assert.equal(twoDigits(3), "03");
  assert.equal(twoDigits(12), "12");
});

test("coach course: nine modules, unique slugs, every part filled in", () => {
  assert.equal(COACH_MODULES.length, 9);
  assert.equal(new Set(COACH_MODULES.map((m) => m.slug)).size, COACH_MODULES.length);
  for (const m of COACH_MODULES) {
    assert.match(m.slug, SLUG, m.slug);
    assert.ok(m.title && m.summary && m.thisWeek && m.takeaway && m.reflect.prompt && m.reflect.hint, m.slug);
    assert.ok(m.why.length >= 2, `${m.slug}: why`);
    assert.ok(m.steps.length >= 4, `${m.slug}: steps`);
    for (const s of m.sayThis ?? []) assert.ok(s.say && s.notThis, `${m.slug}: say this`);
  }
  assert.equal(COACH_NOTES_MAX, 2000);
});

test("coach modules pair with real player lessons, and every player lesson has a coach module", () => {
  const paired = new Set<string>();
  for (const m of COACH_MODULES) {
    for (const s of m.pairsWith) {
      assert.ok(lessonBySlug(s), `${m.slug}: no player lesson ${s}`);
      paired.add(s);
    }
  }
  for (const l of MENTAL_LESSONS) assert.ok(paired.has(l.slug), `no coach module goes with ${l.slug}`);
});

test("coach course: the wellbeing module gives the crisis line", () => {
  const line = moduleBySlug("know-the-line");
  assert.ok(line);
  assert.ok(line.steps.some((s) => s.text.includes("988")));
});

test("coach course: lookups, numbers, neighbors and counts", () => {
  assert.equal(moduleNumber("your-words"), 1);
  assert.equal(moduleNumber("nope"), 0);
  assert.equal(moduleNeighbors("your-words").prev, null);
  assert.equal(moduleNeighbors(COACH_MODULES.at(-1)!.slug).next, null);
  assert.equal(modulesDone(["your-words", "team-reset", "nerves"]), 2);
});

test("player and coach slugs don't collide (each table has its own, but links stay unambiguous)", () => {
  const players = new Set(MENTAL_LESSONS.map((l) => l.slug));
  for (const m of COACH_MODULES) assert.ok(!players.has(m.slug), m.slug);
});
