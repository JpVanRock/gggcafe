// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAPTERS, CHAPTER_COUNT, LINEUP, chapterStatus, courseProgress, playNotation, type BoxMarks, type ChapterProgress, type Visual,
} from "../../src/lib/scorebook.ts";

test("play notation: fielders in order, one fielder alone is unassisted", () => {
  assert.equal(playNotation([6, 3]), "6-3");
  assert.equal(playNotation([6, 4, 3]), "6-4-3");
  assert.equal(playNotation([3]), "3U");
  assert.equal(playNotation([]), "");
});

test("chapters unlock in order and move from new to reading to quiz to complete", () => {
  const none: ChapterProgress[] = [];
  assert.equal(chapterStatus(1, none, []), "new");
  assert.equal(chapterStatus(2, none, []), "locked");
  assert.equal(chapterStatus(1, [{ chapter: 1, step: 3, completedAt: null }], []), "reading");
  assert.equal(chapterStatus(1, [{ chapter: 1, step: 7, completedAt: "2026-11-07T20:00:00Z" }], []), "quiz");
  assert.equal(chapterStatus(1, none, [1]), "complete");
  assert.equal(chapterStatus(2, none, [1]), "new");
  // progress on a locked chapter doesn't open it
  assert.equal(chapterStatus(3, [{ chapter: 3, step: 2, completedAt: "2026-11-07T20:00:00Z" }], [1]), "locked");
});

test("course progress counts awards and points at the next open chapter", () => {
  assert.deepEqual(courseProgress([], []), { done: 0, total: CHAPTER_COUNT, next: 1 });
  assert.deepEqual(courseProgress([], [1, 2]), { done: 2, total: CHAPTER_COUNT, next: 3 });
  assert.deepEqual(courseProgress([], [1, 2, 3, 4, 5, 6]), { done: 6, total: CHAPTER_COUNT, next: null });
});

function checkMarks(where: string, m: BoxMarks) {
  if (m.path !== undefined) assert.ok(m.path >= 0 && m.path <= 4, `${where}: path 0-4`);
  for (const seg of m.fresh ?? []) assert.ok(seg >= 1 && seg <= (m.path ?? 0), `${where}: fresh segment ${seg} beyond her path`);
  if (m.rbi) assert.equal(m.path, 4, `${where}: an RBI number needs a run`);
}

function checkVisual(where: string, v: Visual) {
  if (v.kind === "box") return checkMarks(where, v);
  if (v.kind === "field") {
    for (const n of [...(v.highlight ?? []), ...(v.throws ?? []).flat(), ...(v.ball ? [v.ball.to] : [])]) {
      assert.ok(n >= 1 && n <= 9, `${where}: fielder ${n}`);
    }
    return;
  }
  const rows = v.rows ?? 9;
  assert.ok(rows <= LINEUP.length, `${where}: more rows than the sample lineup`);
  for (const [key, marks] of Object.entries(v.cells ?? {})) {
    const [r, n] = key.split("-").map(Number);
    assert.ok(r >= 1 && r <= rows && n >= 1 && n <= v.innings, `${where}: cell ${key} is off the sheet`);
    checkMarks(`${where} ${key}`, marks);
  }
  const hl = v.highlight ?? {};
  if (hl.inning) assert.ok(hl.inning <= v.innings, `${where}: highlighted inning`);
  if (hl.cell) assert.ok(hl.cell[0] <= rows && hl.cell[1] <= v.innings, `${where}: highlighted cell`);
  if (v.tag) assert.ok(v.tag.row <= rows && v.tag.inning <= v.innings, `${where}: tag`);
}

test("every chapter's lessons are well formed", () => {
  assert.deepEqual(CHAPTERS.map((c) => c.n), [1, 2, 3, 4, 5, 6]);
  for (const c of CHAPTERS) {
    assert.ok(c.steps.length >= 6, `chapter ${c.n} is too short`);
    c.steps.forEach((s, i) => {
      const where = `chapter ${c.n} step ${i + 1}`;
      assert.ok(s.title && s.body.length, `${where}: title and text`);
      if (s.visual) checkVisual(where, s.visual);
      if (s.zoom) checkVisual(`${where} zoom`, s.zoom);
      for (const e of s.explore ?? []) checkVisual(`${where} explore ${e.label}`, e.visual);
      if (s.check) assert.ok(s.check.answer >= 0 && s.check.answer < s.check.choices.length, `${where}: check answer`);
      if (s.tap) assert.ok(s.tap.answer.length >= 1 && s.tap.answer.every((n) => n >= 1 && n <= 9), `${where}: tap answer`);
    });
  }
});
