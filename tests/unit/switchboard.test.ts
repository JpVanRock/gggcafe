// Run with: npm run test:unit
// The Switchboard (user, 2026-11-12): what a head coach can turn off, per audience.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALWAYS_ON, AUDIENCES, SECTION_SWITCH, SWITCHES, isSwitchKey, offForPlayer, switchLabel, switchesFor } from "../../src/lib/switchboard.ts";

// the database's check on team_features_off.feature
const KEY = /^(player|parent|mentor)\.[a-z_]{2,30}$/;

test("three groups, every switch in one, keys the database accepts", () => {
  assert.deepEqual(AUDIENCES.map((a) => a.label), ["Players", "Parents", "Mentors"]);
  assert.equal(new Set(SWITCHES.map((s) => s.key)).size, SWITCHES.length, "duplicate keys");
  const prefix = { players: "player.", parents: "parent.", mentors: "mentor." } as const;
  for (const s of SWITCHES) {
    assert.match(s.key, KEY, s.key);
    assert.ok(s.key.startsWith(prefix[s.audience]), `${s.key} sits under ${s.audience}`);
    assert.ok(s.label && s.detail, s.key);
  }
  for (const a of AUDIENCES) assert.ok(switchesFor(a.key).length >= 4, a.key);
  for (const x of ALWAYS_ON) assert.ok(AUDIENCES.some((a) => a.key === x.audience) && x.why, x.label);
});

test("player sections map to player switches, and every switchable section is in the menu bar or a strip link", () => {
  for (const [slug, key] of Object.entries(SECTION_SWITCH)) {
    assert.ok(isSwitchKey(key) && key.startsWith("player."), `${slug} → ${key}`);
  }
  // the player section bar's switchable sections (SECTIONS in (section)/section-nav.tsx)
  for (const s of ["goals", "pop", "mental", "journal", "training", "iq", "trophies", "team"]) assert.ok(SECTION_SWITCH[s], s);
  // every player switch is used by some section
  const used = new Set(Object.values(SECTION_SWITCH));
  for (const s of switchesFor("players")) assert.ok(used.has(s.key), `${s.key} has no section`);
});

test("lookups", () => {
  assert.ok(isSwitchKey("mentor.messages"));
  assert.ok(!isSwitchKey("mentor.everything"));
  assert.ok(!isSwitchKey(null));
  assert.equal(switchLabel("parent.budget"), "Team Budget");
  assert.deepEqual([...offForPlayer([{ feature: "player.goals" }, { feature: "player.goals" }, { feature: "retired.key" }])], ["player.goals"]);
});
