// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAPTERS, DEFAULT_BOOK_TITLE, MY_HABITS_MAX, bookProgress, chapterLabel, chapterNumber, cleanBookTitle, cleanMyHabits, countedChapters,
  visibleChapters,
} from "../../src/lib/advanced-book.ts";

test("the book: an introduction, six chapters from the sheet, then chapters still being written", () => {
  assert.equal(DEFAULT_BOOK_TITLE, "How to Cook");
  assert.equal(CHAPTERS[0].kind, "intro");
  assert.deepEqual(
    countedChapters().map((c) => c.title),
    ["Pre-Game", "Between Innings", "On-Deck Reps", "Response to Failure", "Communication", "Regardless of Circumstances"],
  );
  assert.deepEqual(CHAPTERS.filter((c) => c.status === "coming").map((c) => c.slug), ["my-position", "hitting-approach", "mental-toughness"]);
});

test("slugs and habit keys are unique and safe to store", () => {
  const slugs = CHAPTERS.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9-]{1,40}$/);
  const keys = CHAPTERS.flatMap((c) => c.habits ?? []).map((h) => h.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const c of countedChapters(CHAPTERS)) assert.ok((c.habits?.length ?? 0) >= 3 && c.why?.length, `${c.slug} has a foundation`);
});

test("chapter numbers come from reading order", () => {
  assert.equal(chapterLabel(CHAPTERS[0]), "Introduction");
  assert.equal(chapterNumber("pre-game"), 1);
  assert.equal(chapterNumber("every-pitch"), 6);
  assert.equal(chapterNumber("mental-toughness"), 9);
});

test("the Pitching chapter is only in a confirmed pitcher's book", () => {
  assert.ok(!visibleChapters([]).some((c) => c.slug === "pitching"));
  assert.ok(!visibleChapters(["C", "SS"]).some((c) => c.slug === "pitching"));
  const pitcher = visibleChapters(["P"]);
  assert.equal(chapterNumber("pitching", pitcher), 7);
  assert.equal(chapterNumber("pitching"), null);
  assert.equal(chapterNumber("my-position", pitcher), 8);
  assert.equal(countedChapters(pitcher).length, 7);
  assert.equal(bookProgress([], pitcher).total, 7);
  assert.equal(chapterLabel(pitcher.find((c) => c.slug === "pitching")!, pitcher), "Chapter 7");
});

test("progress counts finished written chapters only", () => {
  const work = (chapter: string, done: boolean) => ({ chapter, owned: [], mine: [], notes: null, completedAt: done ? "2026-11-07T20:00:00Z" : null });
  assert.deepEqual(
    { ...bookProgress([]), next: bookProgress([]).next?.slug },
    { done: 0, total: 6, next: "pre-game" },
  );
  const p = bookProgress([work("pre-game", true), work("between-innings", false), work("my-position", true)]);
  assert.equal(p.done, 1);
  assert.equal(p.next?.slug, "between-innings");
});

test("her own habits and title are cleaned up", () => {
  assert.deepEqual(cleanMyHabits(["  Ten   throws to a target ", "", "ten throws to a target", "Sprint out"]), ["Ten throws to a target", "Sprint out"]);
  assert.equal(cleanMyHabits(Array.from({ length: 20 }, (_, i) => `habit ${i}`)).length, MY_HABITS_MAX);
  assert.equal(cleanBookTitle("  Let   Her   Cook  "), "Let Her Cook");
});
