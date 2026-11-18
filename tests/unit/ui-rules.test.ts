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

test("secondary text is text-muted at full strength (a faded grey fails contrast)", () => {
  assert.deepEqual(find(/(?<![\w/-])text-muted\/\d+/), [], "use text-muted, and dashed borders or a label for a locked or inactive state");
});

/** Every opening <input>, <select> and <textarea> tag (across lines), with its file and line. */
function fieldTags() {
  const tags: { at: string; tag: string }[] = [];
  for (const f of files) {
    if (!f.path.endsWith(".tsx")) continue;
    for (const m of f.text.matchAll(/<(input|select|textarea)\b/g)) {
      // to the tag's closing ">", skipping any inside {…} and quotes
      let depth = 0;
      let quote = "";
      let end = m.index;
      for (let i = m.index + 1; i < f.text.length; i++) {
        const c = f.text[i];
        if (quote) {
          if (c === quote) quote = "";
        } else if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) {
          end = i;
          break;
        }
      }
      const tag = f.text.slice(m.index, end + 1);
      if (/type="(checkbox|radio|hidden|file|range|color|submit)"/.test(tag) || tag.includes("ui-rules: ok")) continue;
      tags.push({ at: `${f.path}:${f.text.slice(0, m.index).split("\n").length}`, tag });
    }
  }
  return tags;
}

test("form fields get their edge and placeholder from fieldClass (3:1 edges, readable placeholders)", () => {
  // the field token is 3:1 against the page and cards (WCAG 1.4.11); navy-600 was 1.9:1
  const handMade = fieldTags().filter((t) => /\bborder-navy-\d+|placeholder:text-/.test(t.tag)).map((t) => t.at);
  assert.deepEqual(handMade, [], "use fieldClass or inputClass from components/ui.tsx");
  assert.deepEqual(find(/placeholder:text-muted\/\d+/), [], "placeholders are full text-muted (a faded one is 3.7:1)");
});

test("small group labels use groupLabelClass, not a hand-written copy", () => {
  // one recipe for the mono label over a group or list (design audit G1: it had drifted into ~70 copies)
  assert.deepEqual(find(/font-mono text-2xs font-bold tracking-\[0\.2em\]/, (p) => p === "components/ui.tsx"), [], "use groupLabelClass from components/ui.tsx");
});

test("neon edges use the neon-edge token (navy by day, where neon on white is 1.15:1)", () => {
  assert.deepEqual(find(/(?<![\w-])(?:border(?:-[trblxy])?|ring|outline|divide)-neon(?:\/\d+)?(?![\w-])/), [], "use border-neon-edge (ring-neon-edge...)");
});

test("corners are rounded-2xl at most (no bubbly 3xl or 2rem radii on boards and cards)", () => {
  assert.deepEqual(find(/(?<![\w-])rounded(?:-[trblse]{1,2})?-(?:3xl|4xl|\[(?:[2-9]|1\.[5-9])\d*rem\])(?![\w-])/), [], "use rounded-2xl or less (CLAUDE.md, Design audience)");
});

test("text on neon or pink fills is navy (text-on-accent)", () => {
  // white on brand pink is 3.7:1, too faint for small text
  assert.deepEqual(find(/\bbg-(?:pink|neon)\b[^"`]*\btext-white\b|\btext-white\b[^"`]*\bbg-(?:pink|neon)\b/), []);
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
