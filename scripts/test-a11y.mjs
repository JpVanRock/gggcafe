// Accessibility check: loads every page of a production build in sample-data mode in headless
// Chrome and runs axe-core's WCAG 2.2 A/AA rules on it, in Night Game, then the color-contrast rule
// again in Day Game. Fails on any critical or serious problem; lists moderate and minor ones.
//   npm run test:a11y            (after `npm run build`; needs Chrome, or CHROME_PATH)
//   npm run test:a11y -- /teams  (only pages whose path contains /teams)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, samplePages, startSampleSite } from "./lib/sample-site.mjs";
import { launchChrome } from "./lib/chrome.mjs";

const PORT = Number(process.env.TEST_A11Y_PORT ?? 3158);
const only = process.argv.slice(2).find((a) => a.startsWith("/"));
const pages = samplePages().filter((p) => !only || p.includes(only));
const AXE = readFileSync(join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const FAILS = new Set(["critical", "serious"]);

/** axe on the current page: [{ id, impact, help, nodes: [selector…] }] */
function runAxe(page, options) {
  return page.evaluate(`(async () => {
    if (!window.axe) { ${AXE}\n }
    const r = await axe.run(document, ${JSON.stringify(options)});
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")) }));
  })()`);
}

async function check(browser, base, passes) {
  const found = [];
  for (const pass of passes) {
    const queue = [...pages];
    // a few tabs at a time
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        const page = await browser.newPage({ theme: pass.theme });
        for (let path = queue.shift(); path; path = queue.shift()) {
          try {
            await page.goto(base + path);
            // one retry: a late client-side redirect can replace the page while axe runs
            const violations = await runAxe(page, pass.options).catch(() => runAxe(page, pass.options));
            for (const v of violations) found.push({ ...v, path, theme: pass.theme });
          } catch (e) {
            found.push({ id: "page-failed", impact: "critical", help: String(e instanceof Error ? e.message : e), nodes: [], path, theme: pass.theme });
          }
        }
        await page.close();
      }),
    );
  }
  return found;
}

let site;
let browser;
try {
  site = await startSampleSite(PORT);
  browser = await launchChrome();
  const found = await check(browser, site.base, [
    { theme: "night", options: { runOnly: { type: "tag", values: WCAG }, resultTypes: ["violations"] } },
    { theme: "day", options: { runOnly: { type: "rule", values: ["color-contrast"] }, resultTypes: ["violations"] } },
  ]);
  // one line per rule, with the pages and a few of the elements
  const byRule = new Map();
  for (const v of found) {
    const key = `${v.impact}|${v.id}|${v.theme}`;
    const r = byRule.get(key) ?? { ...v, pages: new Set(), samples: new Set() };
    r.pages.add(v.path);
    for (const n of v.nodes.slice(0, 3)) if (r.samples.size < 4) r.samples.add(n);
    byRule.set(key, r);
  }
  const rules = [...byRule.values()].sort((a, b) => Number(FAILS.has(b.impact)) - Number(FAILS.has(a.impact)) || a.id.localeCompare(b.id));
  for (const r of rules) {
    console.log(`${FAILS.has(r.impact) ? "FAIL" : "note"} ${r.impact.padEnd(8)} ${r.id} (${r.theme}): ${r.help}`);
    console.log(`     ${r.pages.size} page${r.pages.size === 1 ? "" : "s"}: ${[...r.pages].slice(0, 4).join(", ")}${r.pages.size > 4 ? ", …" : ""}`);
    for (const s of r.samples) console.log(`       ${s}`);
  }
  const failing = rules.filter((r) => FAILS.has(r.impact));
  console.log(`\n${pages.length} pages checked in Night Game (WCAG 2.2 A/AA) and Day Game (contrast): ${failing.length} failing rule${failing.length === 1 ? "" : "s"}, ${rules.length - failing.length} note${rules.length - failing.length === 1 ? "" : "s"}.`);
  await browser.close();
  site.stop();
  process.exit(failing.length ? 1 : 0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  await browser?.close();
  site?.stop();
  process.exit(1);
}
