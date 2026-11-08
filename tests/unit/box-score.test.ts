// Run with: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { boxProblems, emptyBatting, ipLabel, parseIp, parseSwings, qabSummary, type BoxScore } from "../../src/lib/box-score.ts";
import { STAT_INFO, rateLabel } from "../../src/lib/stat-formulas.ts";

test("innings pitched as outs", () => {
  assert.equal(parseIp("4.2"), 14);
  assert.equal(parseIp("5"), 15);
  assert.equal(parseIp("0.1"), 1);
  assert.equal(parseIp("4.3"), null);
  assert.equal(parseIp("abc"), null);
  assert.equal(ipLabel(14), "4.2");
  assert.equal(ipLabel(21), "7.0");
});

test("box score checks mirror the database", () => {
  const box: BoxScore = {
    us: 5,
    them: 2,
    batting: [{ ...emptyBatting("a"), pa: 3, ab: 2, h: 3, d: 1, so: 0, bb: 1 }],
    pitching: [
      { player_id: "p", outs: 21, bf: 25, h: 4, r: 2, er: 3, bb: 1, so: 8, hbp: 0, hr: 5, wp: 0, pitches: 90, strikes: 95, decision: "W", starter: true },
      { player_id: "q", outs: 0, bf: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hbp: 0, hr: 0, wp: 0, pitches: null, strikes: null, decision: "W", starter: false },
    ],
    fielding: [],
    grades: [{ player_id: "a", pa_no: 4, grade: 5 }],
  };
  const name = (id: string) => id.toUpperCase();
  assert.deepEqual(boxProblems(box, name), [
    "A: more hits than at-bats.",
    "P: more earned runs than runs.",
    "P: more home runs than hits allowed.",
    "P: more strikes than pitches.",
    "Only one pitcher gets the win.",
    "A: a grade for a plate appearance she didn't have.",
  ]);
  assert.deepEqual(boxProblems({ us: 1, them: 0, batting: [{ ...emptyBatting("a"), pa: 4, ab: 3, h: 1, bb: 1 }], pitching: [], fielding: [], grades: [] }, name), []);
});

test("quality at-bats and production", () => {
  assert.deepEqual(qabSummary([5, 3, 0, 2]), { graded: 4, quality: 2, qabPct: 50, production: 2.5 });
  assert.deepEqual(qabSummary([]), { graded: 0, quality: 0, qabPct: null, production: null });
  assert.deepEqual(parseSwings("5 4 3, 0"), [5, 4, 3, 0]);
  assert.equal(parseSwings("6"), null);
  assert.equal(parseSwings(""), null);
});

test("every stat explains itself, ERA on 7 innings", () => {
  for (const [k, v] of Object.entries(STAT_INFO)) {
    assert.equal(v.abbr, k);
    assert.ok(v.formula.length > 5, k);
  }
  assert.match(STAT_INFO.ERA.formula, /× 7/);
  assert.equal(rateLabel(0.4123), ".412");
  assert.equal(rateLabel(1.05), "1.050");
  assert.equal(rateLabel(null), "–");
});
