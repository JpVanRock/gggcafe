// Accessibility check: loads every page of a production build in sample-data mode in headless
// Chrome and runs axe-core's WCAG 2.2 A/AA rules on it, in Night Game, then the color-contrast rule
// again in Day Game, then reflow on a 320px phone (nothing wider than the screen). Fails on any critical
// or serious problem; lists moderate and minor ones.
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

/**
 * WCAG 1.4.10 Reflow on a 320px phone: nothing may stick out past the screen's right edge. The site
 * clips sideways overflow (globals.css), which would hide the problem, so the check lifts that clip
 * first. Unclipped, a too-wide page makes phones zoom out, and the page fills only the left part of
 * the screen (user, 2026-11-22: Team Budget on iPhone).
 */
function runReflow(page) {
  return page.evaluate(`(() => {
    const lift = document.createElement("style");
    lift.textContent = "html { overflow-x: visible !important }";
    document.head.append(lift);
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    if (sw <= vw + 1) { lift.remove(); return []; }
    // what sticks out: absolutely positioned pieces, or anything not inside a sideways scroller
    const inScroller = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") return true;
      return false;
    };
    const out = [...document.body.querySelectorAll("*")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > vw + 1 && (getComputedStyle(el).position === "absolute" || !inScroller(el));
    });
    const outer = out.filter((el) => !out.some((o) => o !== el && o.contains(el)));
    const name = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 4).join(".") : "")
      + ' "' + (el.textContent || "").trim().slice(0, 30) + '"';
    lift.remove();
    return [{ id: "reflow", impact: "serious", help: "Page is " + sw + "px wide on a " + vw + "px phone screen (WCAG 1.4.10 Reflow)", nodes: outer.slice(0, 3).map(name) }];
  })()`);
}

async function check(browser, base, passes) {
  const found = [];
  for (const pass of passes) {
    const queue = [...pages];
    // a few tabs at a time
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        const page = await browser.newPage({ theme: pass.theme, width: pass.width, mobile: pass.width < 768 });
        for (let path = queue.shift(); path; path = queue.shift()) {
          try {
            await page.goto(base + path);
            // one retry: a late client-side redirect can replace the page while the check runs
            const violations = await pass.run(page).catch(() => pass.run(page));
            for (const v of violations) found.push({ ...v, path, theme: pass.label });
          } catch (e) {
            found.push({ id: "page-failed", impact: "critical", help: String(e instanceof Error ? e.message : e), nodes: [], path, theme: pass.label });
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
    { label: "night", theme: "night", run: (page) => runAxe(page, { runOnly: { type: "tag", values: WCAG }, resultTypes: ["violations"] }) },
    { label: "day", theme: "day", run: (page) => runAxe(page, { runOnly: { type: "rule", values: ["color-contrast"] }, resultTypes: ["violations"] }) },
    { label: "phone 320px", theme: "night", width: 320, run: runReflow },
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
  console.log(`\n${pages.length} pages checked in Night Game (WCAG 2.2 A/AA), Day Game (contrast) and on a 320px phone (reflow): ${failing.length} failing rule${failing.length === 1 ? "" : "s"}, ${rules.length - failing.length} note${rules.length - failing.length === 1 ? "" : "s"}.`);
  await browser.close();
  site.stop();
  process.exit(failing.length ? 1 : 0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  await browser?.close();
  site?.stop();
  process.exit(1);
}
