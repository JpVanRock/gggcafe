// Run with: npm run test:unit
// Replays every How to Keep the Book game from its answer key and checks the key
// against the play-by-play: who's batting, who's on base, outs, runs, line score.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLEAN_BOOK, GAMES, GAME_COUNT, GAME_PLAYS, boxId, canonicalMarks, formatPlay, lineFromBook, parsePlay, runnersOn, teamsOf, type Team,
} from "../../src/lib/scorebook-game.ts";
import type { BoxMarks } from "../../src/lib/scorebook.ts";

type Key = { n: number; line: { V: number[]; H: number[] }; plays: { n: number; boxes: Record<string, BoxMarks> }[] };
const keys = (JSON.parse(readFileSync(new URL("../../supabase/iq/scorebook-games.json", import.meta.url), "utf8")) as { games: Key[] }).games;

test("ten games of 15 batters; 12 right on the first try for a clean book", () => {
  assert.equal(GAME_COUNT, 10);
  assert.deepEqual(GAMES.map((g) => g.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(keys.map((k) => k.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const g of GAMES) {
    assert.equal(g.calls.length, GAME_PLAYS, `game ${g.n} batters`);
    assert.notEqual(g.visitors, g.home);
  }
  assert.equal(CLEAN_BOOK, 12);
});

test("writing plays from the keypad", () => {
  assert.equal(formatPlay(["6", "4", "3", "DP"]), "6-4-3 DP");
  assert.equal(formatPlay(["F", "8"]), "F8");
  assert.equal(formatPlay(["E", "6"]), "E6");
  assert.equal(formatPlay(["3", "U"]), "3U");
  assert.equal(formatPlay(["Kc"]), "Kc");
  for (const p of ["6-4-3 DP", "4-6-3 DP", "F8", "L5", "E6", "5-3", "6-4", "K", "Kc", "3U", "FC"]) assert.equal(formatPlay(parsePlay(p)), p, p);
});

for (const game of GAMES) {
  test(`game ${game.n}: the key matches the play-by-play, inning by inning`, () => {
    const key = keys[game.n - 1];
    const teams = teamsOf(game);
    const book: Record<string, BoxMarks> = {};
    const outs = new Map<string, number>();
    const nextUp: Record<Team, number> = { V: 1, H: 1 };
    const halves: string[] = [];
    const runs = { V: 0, H: 0 };
    let ledBeforeLastPlay = 0;

    for (const call of game.calls) {
      const where = `game ${game.n} play ${call.n}`;
      const play = key.plays[call.n - 1];
      assert.equal(play.n, call.n);
      const half = `${call.team}${call.inning}`;
      if (halves[halves.length - 1] !== half) {
        if (halves.length) assert.equal(outs.get(halves[halves.length - 1]), 3, `${where}: the last half-inning ended with 3 outs`);
        halves.push(half);
      }
      // the batting order carries over from inning to inning
      assert.equal(call.batter, nextUp[call.team], `${where}: batter`);
      nextUp[call.team] = (call.batter % 9) + 1;

      const batter = boxId(call.team, call.batter, call.inning);
      const ids = Object.keys(play.boxes);
      assert.ok(ids.includes(batter), `${where}: the batter's box ${batter} is in the key`);
      assert.ok(!book[batter], `${where}: ${batter} is a fresh box`);
      assert.deepEqual(ids.filter((id) => id !== batter).sort(), runnersOn(book, call.team, call.inning).sort(), `${where}: runners`);

      ledBeforeLastPlay = runs.H - runs.V;
      // on a double play the lead runner is out first, so count outs in order
      const inOrder = Object.entries(play.boxes).sort((a, b) => (a[1].out ?? 0) - (b[1].out ?? 0));
      for (const [id, marks] of inOrder) {
        assert.deepEqual(canonicalMarks(marks), marks, `${where} ${id}: canonical`);
        if (marks.play) assert.equal(formatPlay(parsePlay(marks.play)), marks.play, `${where} ${id}: play`);
        if (marks.out && !book[id]?.out) {
          const n = (outs.get(half) ?? 0) + 1;
          outs.set(half, n);
          assert.equal(marks.out, n, `${where} ${id}: out number`);
          assert.equal(Boolean(marks.lastOut), n === 3, `${where} ${id}: slash only on the third out`);
        }
        if (marks.path === 4 && book[id]?.path !== 4) {
          runs[call.team] += 1;
          assert.equal(marks.rbi, teams[call.team].lineup[call.batter - 1].no, `${where} ${id}: RBI to the batter`);
        }
        // a runner's box only grows: earlier marks stay
        for (const [field, value] of Object.entries(book[id] ?? {})) {
          if (field !== "path") assert.deepEqual((marks as Record<string, unknown>)[field], value, `${where} ${id}: kept ${field}`);
        }
        book[id] = marks;
      }
    }

    // every half-inning has 3 outs, except a walk-off in the bottom of the 2nd
    assert.deepEqual(halves, ["V1", "H1", "V2", "H2"], `game ${game.n}: all four half-innings are played`);
    const lastOuts = outs.get("H2") ?? 0;
    if (lastOuts < 3) {
      assert.ok(runs.H > runs.V && ledBeforeLastPlay <= 0, `game ${game.n}: a walk-off ends the game the moment the Storm take the lead`);
    } else {
      assert.ok(runs.V > runs.H, `game ${game.n}: three outs in the bottom of the 2nd means the visitors won`);
    }
    assert.notEqual(runs.V, runs.H, `game ${game.n}: no ties`);
    assert.deepEqual(lineFromBook(book), key.line, `game ${game.n}: line score`);
  });
}
