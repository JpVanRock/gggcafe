// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_LESSONS, BONUS, CHECKIN_SOURCE, checkInActivity, checkInChanges, BONUS_SHELVES, CORE_PARTS, ENGAGEMENT_ASK, HABITS, LADDER, LEADER_ROLES, LESSONS, RUBRIC, RUBRIC_MAX, SCENARIOS,
  SCENARIO_GROUPS, STARTER_GROUPS, answerKeys, bonusProgress, cleanAnswer, cleanPlan, courseReady, findLesson, guideProgress, lessonLabel,
  lessonNumber, planReady, rubricTotal, validCoachRating, LIGHT_LESSONS, LIGHT_PARTS, LIGHT_KEYS, LIGHT_PLAN_SHOW, LIGHT_COMMITMENT, PROGRAMS, isProgram,
  programLessons, lessonProgram, certificateFor, certificateProgram, CERTIFICATE, CERTIFICATE_LIGHT,
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
    assert.equal(l.questions.length, l.kind === "light" ? 2 : 3, `${l.slug}: questions`);
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

test("Leadership Light: eight short lessons of its own, for players 11 and under", () => {
  assert.equal(LIGHT_LESSONS.length, 8);
  assert.deepEqual([...PROGRAMS], ["full", "light"]);
  assert.ok(isProgram("light") && isProgram("full") && !isProgram("medium") && !isProgram(undefined));
  assert.equal(programLessons("light"), LIGHT_LESSONS);
  assert.equal(programLessons("full"), LESSONS);
  for (const [i, l] of LIGHT_LESSONS.entries()) {
    assert.equal(l.kind, "light");
    assert.match(l.slug, /^light-/, `${l.slug}: light- slug`);
    assert.ok((LIGHT_PARTS as readonly string[]).includes(l.part), `${l.slug}: part`);
    assert.equal(l.tool, undefined, `${l.slug}: no tools in Light`);
    assert.equal(l.steps.length, 2, `${l.slug}: two challenges`);
    assert.equal(lessonNumber(l.slug), i + 1);
    assert.equal(lessonLabel(l), `Lesson ${i + 1}`);
    assert.equal(lessonProgram(l), "light");
    // short and readable: a big idea of one sentence and two short paragraphs
    assert.ok(l.bigIdea.length <= 100 && l.body.length <= 2, `${l.slug}: short`);
    assert.ok(l.body.every((p) => p.length <= 320), `${l.slug}: short paragraphs`);
  }
  assert.equal(lessonProgram(LESSONS[0]), "full");
  assert.equal(lessonProgram(BONUS[0]), "full");
  for (const part of LIGHT_PARTS) assert.ok(LIGHT_LESSONS.some((l) => l.part === part), `${part}: has lessons`);
  assert.ok(LIGHT_KEYS.length >= 3 && LIGHT_COMMITMENT.length >= 3);
});

test("Leadership Light: its own progress, a short plan and its own certificate", () => {
  const done = (lesson: string) => ({ lesson, answers: {}, steps: [], completedAt: "2026-11-10T12:00:00Z" });
  const light = LIGHT_LESSONS.map((l) => done(l.slug));
  assert.equal(guideProgress([], "light").next?.slug, LIGHT_LESSONS[0].slug);
  assert.equal(guideProgress(light, "light").done, 8);
  assert.ok(courseReady(light, "2026-11-10T12:00:00Z", "light"));
  assert.ok(!courseReady(light, "2026-11-10T12:00:00Z"), "Light lessons don't finish the Full program");
  assert.ok(!courseReady(LESSONS.map((l) => done(l.slug)), "2026-11-10T12:00:00Z", "light"), "Full lessons don't finish Light");
  // the short plan still meets the commit rule: a why, one habit, one goal
  assert.deepEqual([LIGHT_PLAN_SHOW.habits, LIGHT_PLAN_SHOW.goals], [1, 1]);
  assert.ok(planReady(cleanPlan({ why: "Make my team better", habits: ["Cheer every pitch"], goals: [{ goal: "Learn every teammate's name", steps: [] }] })));
  assert.equal(certificateFor("light").text, CERTIFICATE_LIGHT);
  assert.equal(certificateFor("full").text, CERTIFICATE);
  assert.match(CERTIFICATE_LIGHT.completed, /Leadership Light/);
  assert.equal(CERTIFICATE_LIGHT.honor, CERTIFICATE.honor, "both earn the Team Leader badge");
  // finishing Full after Light upgrades the certificate; a Full certificate is never traded down
  assert.equal(certificateProgram("full", "light"), "full");
  assert.equal(certificateProgram("light", null), "light");
  assert.equal(certificateProgram("light", "full"), "full");
});
