// Run with: npm run test:unit
// Replays the How to Keep the Book game from its answer key and checks the key
// against the play-by-play: who's batting, who's on base, outs, runs, line score.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CALLS, CLEAN_BOOK, GAME_PLAYS, TEAMS, boxId, canonicalMarks, formatPlay, lineFromBook, parsePlay, runnersOn,
} from "../../src/lib/scorebook-game.ts";
import type { BoxMarks } from "../../src/lib/scorebook.ts";

const key = JSON.parse(readFileSync(new URL("../../supabase/iq/scorebook-game.json", import.meta.url), "utf8")) as {
  line: { V: number[]; H: number[] };
  plays: { n: number; boxes: Record<string, BoxMarks> }[];
};

test("15 batters, 12 right on the first try for a clean book", () => {
  assert.equal(GAME_PLAYS, 15);
  assert.equal(key.plays.length, 15);
  assert.equal(CLEAN_BOOK, 12);
});

test("writing plays from the keypad", () => {
  assert.equal(formatPlay(["6", "4", "3", "DP"]), "6-4-3 DP");
  assert.equal(formatPlay(["F", "8"]), "F8");
  assert.equal(formatPlay(["E", "6"]), "E6");
  assert.equal(formatPlay(["3", "U"]), "3U");
  assert.equal(formatPlay(["Kc"]), "Kc");
  for (const p of ["6-4-3 DP", "F8", "L5", "E6", "5-3", "6-4", "K", "Kc", "3U", "FC"]) {
    assert.equal(formatPlay(parsePlay(p)), p, p);
  }
});

test("the key matches the play-by-play, inning by inning", () => {
  const book: Record<string, BoxMarks> = {};
  const outs = new Map<string, number>();
  for (const call of CALLS) {
    const play = key.plays[call.n - 1];
    assert.equal(play.n, call.n);
    const batter = boxId(call.team, call.batter, call.inning);
    const ids = Object.keys(play.boxes);
    assert.ok(ids.includes(batter), `play ${call.n}: the batter's box ${batter} is in the key`);
    assert.ok(!book[batter], `play ${call.n}: ${batter} is a fresh box`);
    // every runner on base before the pitch is in the key, and nobody else
    assert.deepEqual(ids.filter((id) => id !== batter).sort(), runnersOn(book, call.team, call.inning).sort(), `play ${call.n}: runners`);

    const half = `${call.team}${call.inning}`;
    // on a double play the lead runner is out first, so count outs in order
    const inOrder = Object.entries(play.boxes).sort((a, b) => (a[1].out ?? 0) - (b[1].out ?? 0));
    for (const [id, marks] of inOrder) {
      assert.deepEqual(canonicalMarks(marks), marks, `play ${call.n} ${id}: canonical`);
      if (marks.play) assert.equal(formatPlay(parsePlay(marks.play)), marks.play, `play ${call.n} ${id}: play`);
      if (marks.out && !book[id]?.out) {
        const n = (outs.get(half) ?? 0) + 1;
        outs.set(half, n);
        assert.equal(marks.out, n, `play ${call.n} ${id}: out number`);
        assert.equal(Boolean(marks.lastOut), n === 3, `play ${call.n} ${id}: slash only on the third out`);
      }
      if (marks.path === 4) {
        const batterNo = TEAMS[call.team].lineup[call.batter - 1].no;
        assert.equal(marks.rbi, batterNo, `play ${call.n} ${id}: RBI to the batter`);
      }
      book[id] = marks;
    }
  }
  assert.deepEqual(Object.fromEntries(outs), { V1: 3, H1: 3, V2: 3, H2: 1 }, "three outs a half, walk-off in the last");
  assert.deepEqual(lineFromBook(book), key.line);
});
