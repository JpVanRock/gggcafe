// Screenshots of the key pages for a visual review: phone (390px) and desktop (1280px), Night and
// Day Game, on the fictional sample data, from a production build in headless Chrome.
//   npm run screens                          → screens/<page>-<phone|desktop>-<night|day>.png
//   npm run screens -- --compare old-screens → also marks what changed since an earlier run:
//                                              screens/<name>-diff.png (changed pixels in pink) and
//                                              a list of how much each page changed
// CI keeps each run's screens as a downloadable artifact.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, startSampleSite } from "./lib/sample-site.mjs";
import { launchChrome } from "./lib/chrome.mjs";
import { SAMPLE_IDS as ID } from "../src/lib/supabase/sample/data.ts";

const PORT = Number(process.env.SCREENS_PORT ?? 3156);
const OUT = join(ROOT, "screens");
const compareArg = process.argv.indexOf("--compare");
const BASELINE = compareArg > 0 ? join(ROOT, process.argv[compareArg + 1] ?? "") : null;

const PAGES = [
  ["login", "/login"],
  ["dashboard", "/dashboard"],
  ["roster", `/dugout/roster?team=${ID.team}`],
  ["calendar", `/dugout/calendar?team=${ID.team}`],
  ["install", `/dugout/plans/install?team=${ID.team}`],
  ["lineup", `/dugout/gameday/${ID.lineup}?team=${ID.team}`],
  ["players", "/players"],
  ["player-menu", `/players/${ID.player}`],
  ["softball-iq", `/players/${ID.player}/iq`],
  ["leaderboard", `/players/${ID.player}/leaderboard`],
];
const VIEWS = [
  { name: "phone", width: 390, height: 844, mobile: true },
  { name: "desktop", width: 1280, height: 900, mobile: false },
];
const THEMES = ["night", "day"];

/** Changed pixels between two PNGs, worked out in the browser (canvas), plus a diff image. */
async function compare(page, before, after) {
  const url = (b) => `data:image/png;base64,${b.toString("base64")}`;
  return page.evaluate(`(async () => {
    const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
    const [a, b] = await Promise.all([load(${JSON.stringify(url(before))}), load(${JSON.stringify(url(after))})]);
    const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
    const draw = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const A = draw(a), B = draw(b);
    const c = new OffscreenCanvas(w, h), x = c.getContext("2d"); x.drawImage(b, 0, 0); x.fillStyle = "rgba(255,255,255,0.75)"; x.fillRect(0, 0, w, h);
    const out = x.getImageData(0, 0, w, h);
    let changed = 0;
    for (let i = 0; i < A.length; i += 4) {
      if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 48) {
        changed++; out.data[i] = 254; out.data[i + 1] = 31; out.data[i + 2] = 124; out.data[i + 3] = 255;
      }
    }
    x.putImageData(out, 0, 0);
    const blob = await c.convertToBlob({ type: "image/png" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { changed, total: w * h, sizeChanged: a.width !== b.width || a.height !== b.height, diff: btoa(bin) };
  })()`);
}

let site;
let browser;
try {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  site = await startSampleSite(PORT);
  browser = await launchChrome();
  const changes = [];
  for (const theme of THEMES) {
    for (const view of VIEWS) {
      const page = await browser.newPage({ ...view, theme });
      for (const [name, path] of PAGES) {
        await page.goto(site.base + path);
        const png = await page.screenshot();
        const file = `${name}-${view.name}-${theme}`;
        writeFileSync(join(OUT, `${file}.png`), png);
        if (BASELINE && existsSync(join(BASELINE, `${file}.png`))) {
          const r = await compare(page, readFileSync(join(BASELINE, `${file}.png`)), png);
          if (r.changed > 0) {
            writeFileSync(join(OUT, `${file}-diff.png`), Buffer.from(r.diff, "base64"));
            changes.push(`${file}: ${((100 * r.changed) / r.total).toFixed(2)}% of pixels${r.sizeChanged ? " (page height changed)" : ""}`);
          }
        }
        console.log(`saved ${file}.png`);
      }
      await page.close();
    }
  }
  if (BASELINE) console.log(changes.length ? `\nChanged since ${BASELINE}:\n${changes.join("\n")}` : `\nNo visible changes since ${BASELINE}.`);
  console.log(`\n${PAGES.length * VIEWS.length * THEMES.length} screenshots in screens/.`);
  await browser.close();
  site.stop();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  await browser?.close();
  site?.stop();
  process.exit(1);
}
