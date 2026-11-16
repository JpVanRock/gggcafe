// Run with: npm run test:unit
// The lifecycles in src/lib/lifecycles.ts are well formed, and the guarded ones match the database's
// guards exactly (private.guard_transition triggers in supabase/migrations).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as L from "../../src/lib/lifecycles.ts";

type AnyLifecycle = L.Lifecycle<string, string>;
const LIFECYCLES = Object.entries(L).filter(
  (e): e is [string, AnyLifecycle] => typeof e[1] === "object" && e[1] !== null && "moves" in e[1] && "states" in e[1],
);

test("every lifecycle is well formed", () => {
  assert.ok(LIFECYCLES.length >= 7, "found the lifecycles");
  for (const [name, lc] of LIFECYCLES) {
    const states = [...lc.states].sort();
    assert.equal(new Set(states).size, states.length, `${name}: no repeated states`);
    assert.deepEqual(Object.keys(lc.label).sort(), states, `${name}: a label for each state`);
    assert.deepEqual(Object.keys(lc.tone).sort(), states, `${name}: a tone for each state`);
    assert.ok(lc.states.includes(lc.initial), `${name}: starts in one of its states`);
    for (const [m, move] of Object.entries(lc.moves)) {
      assert.ok(move.from.length > 0, `${name}.${m}: starts somewhere`);
      for (const s of [...move.from, move.to]) assert.ok(lc.states.includes(s), `${name}.${m}: ${s} is a state`);
      assert.ok(move.by.trim().length > 0, `${name}.${m}: says who makes it`);
    }
    // every state can be reached (from the start, through the moves)
    const seen = new Set([lc.initial]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const move of Object.values(lc.moves)) {
        if (!seen.has(move.to) && move.from.some((f) => seen.has(f))) {
          seen.add(move.to);
          grew = true;
        }
      }
    }
    assert.deepEqual([...seen].sort(), states, `${name}: every state can be reached`);
  }
});

test("helpers follow the moves", () => {
  const c = L.PLAYER_CLAIM;
  assert.equal(L.canMove(c, "pending", "approve"), true);
  assert.equal(L.canMove(c, "approved", "approve"), false);
  assert.equal(L.next(c, "declined", "askAgain"), "pending");
  assert.equal(L.next(c, "approved", "decline"), null);
  assert.deepEqual(L.movesFrom(c, "pending"), ["approve", "decline"]);
  assert.deepEqual(L.movesFrom(L.PARENT_LINK, "approved"), []);
  assert.equal(L.isSettled(L.PARENT_LINK, "declined"), true);
  assert.equal(L.isSettled(L.PARENTAL_CONSENT, "verified"), false);
  assert.deepEqual(L.edges(L.PARENTAL_CONSENT), ["pending>declined", "pending>verified", "pending>withdrawn", "verified>withdrawn"]);
  assert.equal(L.isState(c, "approved"), true);
  assert.equal(L.isState(c, "maybe"), false);
  assert.equal(L.isState(c, null), false);
});

/** The guard triggers as the migrations leave them: "table.column" -> sorted edges. */
function databaseGuards(): Map<string, string[]> {
  const dir = join(import.meta.dirname, "../../supabase/migrations");
  const guards = new Map<string, { trigger: string; edges: string[] }>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, file), "utf8");
    for (const m of sql.matchAll(/drop trigger (?:if exists )?(\w+) on public\.(\w+)/gi)) {
      for (const [key, g] of guards) if (key.startsWith(`${m[2]}.`) && g.trigger === m[1]) guards.delete(key);
    }
    const create = /create (?:or replace )?trigger (\w+)\s+before update of (\w+) on public\.(\w+)[\s\S]*?execute function private\.guard_transition\(([^)]*)\)/gi;
    for (const m of sql.matchAll(create)) {
      const args = [...m[4].matchAll(/'([^']*)'/g)].map((a) => a[1]);
      assert.equal(args[0], m[2], `${file}: ${m[1]} guards the column it fires on`);
      guards.set(`${m[3]}.${args[0]}`, { trigger: m[1], edges: args.slice(1).sort() });
    }
  }
  return new Map([...guards].map(([k, g]) => [k, g.edges]));
}

test("guarded lifecycles match the database guards", () => {
  const db = databaseGuards();
  const guarded = LIFECYCLES.filter(([, lc]) => lc.guarded);
  assert.ok(guarded.length >= 5);
  for (const [name, lc] of guarded) {
    const key = lc.column.replace(/^public\./, "");
    assert.ok(db.has(key), `${name}: no guard_transition trigger on ${lc.column} (add one in a new migration)`);
    assert.deepEqual(db.get(key), L.edges(lc), `${name}: the moves here and the database's edges differ`);
  }
  const declared = new Set(guarded.map(([, lc]) => lc.column.replace(/^public\./, "")));
  for (const key of db.keys()) assert.ok(declared.has(key), `public.${key} has a guard but no guarded lifecycle in src/lib/lifecycles.ts`);
});
