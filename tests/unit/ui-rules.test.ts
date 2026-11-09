// Run with: npm run test:unit
// The site's UI rules (src/components/ui.tsx, CLAUDE.md "Design audience" and "Brand"), checked
// across every component and page so they don't slip back in one file at a time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = new URL("../../src/", import.meta.url).pathname;
const files: { path: string; text: string }[] = [];
(function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name)) files.push({ path: relative(SRC, p), text: readFileSync(p, "utf8") });
  }
})(SRC);

/** Every `file:line  match` for a pattern, minus lines that say why they're allowed (`ui-rules: ok`). */
function find(pattern: RegExp, skip: (path: string) => boolean = () => false) {
  const hits: string[] = [];
  for (const f of files) {
    if (skip(f.path)) continue;
    f.text.split("\n").forEach((line, i) => {
      if (line.includes("ui-rules: ok")) return;
      for (const m of line.matchAll(new RegExp(pattern.source, "g"))) hits.push(`${f.path}:${i + 1}  ${m[0]}`);
    });
  }
  return hits;
}

test("no text smaller than 12px (text-2xs is the floor)", () => {
  // arbitrary sizes in px under 12, or rem under 0.75 (container-query sizes on the award art are fine)
  const px = find(/\btext-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/);
  const rem = find(/\btext-\[0?\.(?:[0-6]\d*|7(?:[0-4]\d*)?)rem\]/);
  assert.deepEqual([...px, ...rem], [], "use text-2xs (12px) or larger");
});

test("pink text uses the link token (brand pink is too faint on white in Day Game)", () => {
  assert.deepEqual(find(/(?<![\w-])text-pink(?![\w-])/), [], "use text-link (or text-pink-soft for labels)");
});

test("no browser confirm boxes: use ConfirmSubmit or confirmAction", () => {
  assert.deepEqual(find(/window\.confirm\(/, (p) => p === "components/confirm-submit.tsx"), []);
});

test("colors by role, not by palette", () => {
  // zinc/gray/slate are not brand colors; `dark:` styles don't follow the Night/Day switch
  assert.deepEqual(find(/(?<![\w-])(?:text|bg|border)-(?:zinc|gray|slate|neutral|stone)-\d{2,3}\b/), []);
  assert.deepEqual(find(/(?<![\w-])dark:[\w-]/), []);
});

test("status chips and counts use Badge, badgeClass or CountBadge", () => {
  // a hand-made chip: a rounded box of tiny bold uppercase mono text
  const chips = find(/className=["`{][^"`]*\brounded\b[^"`]*\bpx-(?:1|1\.5|2) py-(?:px|0\.5)\b[^"`]*\bfont-mono text-2xs font-bold\b[^"`]*/, (p) => p === "components/ui.tsx");
  assert.deepEqual(chips, []);
});
