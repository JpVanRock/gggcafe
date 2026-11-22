// Run with: npm run test:unit
// Joined selects the database API can't resolve (user, 2026-11-22: "it says a call is already booked but does not
// show on calendars"). Since group calls (2026-11-14), video_call_players also links video_calls to players, so a
// plain `player:players(...)` on video_calls had two paths and the API refused the whole query (PGRST201): every
// calendar and list of calls came back empty. The sample-data tests don't go through the API, so they missed it.
// This finds every `.from("t").select("... other(...) ...")` in src and fails when there's more than one link between
// the two tables and the embed doesn't name one (`players!player_id(...)`), using the links in database.types.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = new URL("../../src/", import.meta.url).pathname;
const TYPES = readFileSync(join(SRC, "lib/supabase/database.types.ts"), "utf8");

type Rel = { columns: string[]; to: string };
/** Every table's (and view's) columns and foreign keys, from the generated types. */
const schema = new Map<string, { columns: Set<string>; rels: Rel[]; view: boolean }>();
const viewsAt = TYPES.indexOf("\n    Views: {");
for (const m of TYPES.matchAll(/^ {6}(\w+): \{\n {8}Row: \{([\s\S]*?)\n {8}\}[\s\S]*?Relationships: \[([\s\S]*?)\n {8}\]/gm)) {
  const columns = new Set([...m[2].matchAll(/^ {10}(\w+)\??:/gm)].map((c) => c[1]));
  const rels = [...m[3].matchAll(/columns: \[([^\]]*)\][\s\S]*?referencedRelation: "(\w+)"/g)].map((r) => ({
    columns: [...r[1].matchAll(/"(\w+)"/g)].map((c) => c[1]),
    to: r[2],
  }));
  schema.set(m[1], { columns, rels, view: m.index > viewsAt });
}

/** How many ways the API can join `parent` to `child`: foreign keys either way, and link tables between them. */
function links(parent: string, child: string): number {
  const p = schema.get(parent);
  const c = schema.get(child);
  if (!p || !c || parent === child) return 1;
  let n = p.rels.filter((r) => r.to === child).length + c.rels.filter((r) => r.to === parent).length;
  // a link table: one whose key is made of its foreign keys (no id of its own), with a key to each side
  for (const [name, t] of schema) {
    if (t.view || name === parent || name === child || t.columns.has("id")) continue;
    if (t.rels.some((r) => r.to === parent) && t.rels.some((r) => r.to === child)) n += 1;
  }
  return n;
}

/** The top-level items of a select string, split on commas outside parentheses. */
function items(select: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < select.length; i++) {
    if (select[i] === "(") depth++;
    else if (select[i] === ")") depth--;
    else if (select[i] === "," && depth === 0) {
      out.push(select.slice(start, i));
      start = i + 1;
    }
  }
  out.push(select.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Embeds that name no link where there's more than one, as "parent → child (alias)". */
function ambiguous(parent: string, select: string): string[] {
  return items(select).flatMap((item) => {
    const m = /^(?:(\w+):)?(\w+)((?:!\w+)*)\(([\s\S]*)\)$/.exec(item);
    if (!m || !schema.has(m[2])) return [];
    const [, alias, child, hints, inner] = m;
    // `!inner` / `!left` only pick the join; any other `!name` names the link
    const named = hints.split("!").some((h) => h && h !== "inner" && h !== "left");
    const here = !named && links(parent, child) > 1 ? [`${parent} → ${child}${alias ? ` (${alias})` : ""}`] : [];
    return [...here, ...ambiguous(child, inner)];
  });
}

const files: { path: string; text: string }[] = [];
(function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !p.includes("/supabase/")) files.push({ path: relative(SRC, p), text: readFileSync(p, "utf8") });
  }
})(SRC);
// select strings kept in constants (VIDEO_CALL_COLUMNS)
const constants = new Map<string, string>();
for (const f of files) for (const m of f.text.matchAll(/const (\w+)\s*=\s*"([^"]+)"(?: as const)?;/g)) constants.set(m[1], m[2]);

test("the types list the call tables' links (so the check below has something to check)", () => {
  assert.ok(links("video_calls", "players") > 1, "video_calls → players has two links: player_id and video_call_players");
  assert.equal(links("roster_entries", "players"), 1);
});

test("joined selects name the link when two tables have more than one", () => {
  const hits: string[] = [];
  for (const f of files) {
    for (const m of f.text.matchAll(/\.from\("(\w+)"\)\s*\.select\(\s*(?:"([^"]*)"|`([^`$]*)`|(\w+))/g)) {
      const select = m[2] ?? m[3] ?? constants.get(m[4] ?? "");
      if (!select?.includes("(")) continue;
      const line = f.text.slice(0, m.index).split("\n").length;
      for (const h of ambiguous(m[1], select)) hits.push(`${f.path}:${line}  ${h}`);
    }
  }
  assert.deepEqual(hits, [], "name the link, e.g. player:players!player_id(...): the API refuses the whole query otherwise (PGRST201)");
});
