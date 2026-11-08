// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_LESSONS, BONUS, CHECKIN_SOURCE, checkInActivity, checkInChanges, BONUS_SHELVES, CORE_PARTS, ENGAGEMENT_ASK, HABITS, LADDER, LEADER_ROLES, LESSONS, RUBRIC, RUBRIC_MAX, SCENARIOS,
  SCENARIO_GROUPS, STARTER_GROUPS, answerKeys, bonusProgress, cleanAnswer, cleanPlan, courseReady, findLesson, guideProgress, lessonLabel,
  lessonNumber, planReady, rubricTotal, validCoachRating,
} from "../../src/lib/leadership-guide.ts";

test("twenty-five core lessons on a seven-rung ladder, and twenty-two Extra Reps", () => {
  assert.equal(LESSONS.length, 25);
  assert.equal(BONUS.length, 25);
  assert.equal(LADDER.length, 7);
  assert.equal(lessonNumber("why-leadership"), 1);
  assert.equal(lessonNumber("keep-growing"), 25);
  assert.equal(lessonNumber("title-or-choice"), 1);
  assert.equal(lessonLabel(findLesson("put-in-the-work")!), "Extra Rep 22");
  assert.equal(lessonLabel(findLesson("all-in")!), "Lesson 7");
  assert.equal(findLesson("nope"), null);
  for (const l of LESSONS) assert.ok((CORE_PARTS as readonly string[]).includes(l.part), `${l.slug}: core part`);
  for (const l of BONUS) assert.ok((BONUS_SHELVES as readonly string[]).includes(l.part), `${l.slug}: shelf`);
  for (const shelf of BONUS_SHELVES) assert.ok(BONUS.some((l) => l.part === shelf), `${shelf}: has lessons`);
});

test("every lesson is complete and its keys are safe to store", () => {
  const slugs = ALL_LESSONS.map((l) => l.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const reserved of ["plan", "certificate"]) assert.ok(!slugs.includes(reserved), `${reserved} is a page, not a lesson`);
  for (const l of ALL_LESSONS) {
    assert.match(l.slug, /^[a-z0-9-]{1,40}$/);
    assert.ok(l.bigIdea && l.body.length, `${l.slug}: text`);
    assert.equal(l.questions.length, 3, `${l.slug}: three questions`);
    assert.ok(l.steps.length >= 2 && l.steps.length <= 3, `${l.slug}: two or three steps`);
    const keys = answerKeys(l);
    assert.equal(new Set(keys).size, keys.length, `${l.slug}: unique answer keys`);
    assert.equal(new Set(l.steps.map((s) => s.key)).size, l.steps.length, `${l.slug}: unique steps`);
    for (const list of l.lists ?? []) assert.equal(new Set(list.points).size, list.points.length, `${l.slug}: unique points`);
  }
  for (const list of [HABITS, RUBRIC, SCENARIOS, LEADER_ROLES, ENGAGEMENT_ASK].map((items) => items.map((i) => i.key))) {
    assert.equal(new Set(list).size, list.length);
  }
  for (const s of SCENARIOS) assert.ok((SCENARIO_GROUPS as readonly string[]).includes(s.group) && s.move, `${s.key}: group and move`);
  assert.equal(STARTER_GROUPS.flatMap((g) => g.lines).length, 15);
  assert.equal(LEADER_ROLES.length, 7);
  assert.equal(RUBRIC.length, 13);
  // each tool lives in exactly one core lesson
  for (const tool of ["habits", "rubric", "scenarios", "starters", "roles", "engagement"]) {
    assert.equal(LESSONS.filter((l) => l.tool === tool).length, 1, `${tool}: one lesson`);
  }
});

test("answers are checked against the lesson", () => {
  const habits = LESSONS.find((l) => l.tool === "habits")!;
  const rubric = LESSONS.find((l) => l.tool === "rubric")!;
  const engagement = LESSONS.find((l) => l.tool === "engagement")!;
  const roles = LESSONS.find((l) => l.tool === "roles")!;
  const first = LESSONS[0];
  assert.equal(cleanAnswer(first, "q1", "  Lift the team  "), "Lift the team");
  assert.equal(cleanAnswer(first, "nope", "x"), null);
  assert.equal(cleanAnswer(habits, HABITS[0].key, "strength"), "strength");
  assert.equal(cleanAnswer(habits, HABITS[0].key, "maybe"), null);
  assert.equal(cleanAnswer(rubric, RUBRIC[0].key, "5"), "5");
  assert.equal(cleanAnswer(rubric, RUBRIC[0].key, "6"), null);
  assert.equal(cleanAnswer(engagement, "e-me", "3"), "3");
  assert.equal(cleanAnswer(engagement, "e-me", "x"), null);
  assert.equal(cleanAnswer(roles, "role-glue", " Maya "), "Maya");
  assert.equal(cleanAnswer(first, HABITS[0].key, "strength"), null);
  assert.ok(validCoachRating("r-work", "5"));
  assert.ok(validCoachRating("r-work", ""));
  assert.ok(!validCoachRating("r-work", "0"));
  assert.ok(!validCoachRating("e-me", "3"));
});

test("rubric totals count what's rated", () => {
  assert.equal(RUBRIC_MAX, 65);
  assert.deepEqual(rubricTotal({ "r-work": "5", "r-clear": "3", nope: "5" }), { total: 8, rated: 2 });
});

test("the plan is cleaned up and needs a why, a habit and a goal to commit", () => {
  const plan = cleanPlan({ why: "  To lift my team  ", habits: ["Talk to everyone"], goals: [{ goal: "Two team nights by May", steps: ["Ask coach"] }], checkIns: ["2027-03-01", "soon"] });
  assert.equal(plan.why, "To lift my team");
  assert.deepEqual(plan.habits, ["Talk to everyone", "", ""]);
  assert.equal(plan.goals?.length, 2);
  assert.deepEqual(plan.goals?.[0].steps, ["Ask coach", ""]);
  assert.deepEqual(plan.checkIns, ["2027-03-01", "", ""]);
  assert.ok(planReady(plan));
  assert.ok(!planReady(cleanPlan({ why: "To lead" })));
});

test("progress: core lessons drive the course, Extra Reps count on their own", () => {
  assert.equal(guideProgress([]).next?.slug, "why-leadership");
  const done = (lesson: string) => ({ lesson, answers: {}, steps: [], completedAt: "2026-11-08T12:00:00Z" });
  const p = guideProgress([done("why-leadership"), done("feel-it-then-choose")]);
  assert.equal(p.done, 1);
  assert.equal(p.next?.slug, "what-is-leadership");
  assert.equal(bonusProgress([done("feel-it-then-choose")]).done, 1);
  const all = LESSONS.map((l) => done(l.slug));
  assert.ok(!courseReady(all, null), "needs the committed plan");
  assert.ok(!courseReady(all.slice(1), "2026-11-08T12:00:00Z"), "needs every core lesson");
  assert.ok(courseReady(all, "2026-11-08T12:00:00Z"), "Extra Reps are optional");
});

test("check-in dates become one-day TWIS reminders, kept in step with the plan", () => {
  const sunday = checkInActivity("2026-11-08");
  assert.deepEqual([sunday.days, sunday.starts_on, sunday.ends_on, sunday.source], [[7], "2026-11-08", "2026-11-08", CHECKIN_SOURCE]);
  assert.deepEqual(checkInActivity("2026-11-09").days, [1]);
  const existing = [
    { id: "keep", starts_on: "2026-12-01" },
    { id: "drop", starts_on: "2026-11-20" },
  ];
  assert.deepEqual(checkInChanges(["2026-12-01", "2027-01-05", "", undefined, "2027-01-05", "soon"], existing), {
    add: ["2027-01-05"],
    remove: ["drop"],
  });
  assert.deepEqual(checkInChanges([], existing).remove, ["keep", "drop"]);
});
