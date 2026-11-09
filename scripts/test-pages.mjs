// Page smoke test: renders every page (and the PDF routes) of a production build in sample-data
// mode (fictional data, signed in as a sample admin; see src/lib/supabase/sample/) and fails
// when a page errors, crashes, sends you to sign in, or the server logs an error.
//   npm run test:pages            (after `npm run build`)
//   npm run test:pages -- --build (builds first)
import { spawn, spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { SAMPLE_IDS as ID } from "../src/lib/supabase/sample/data.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = Number(process.env.TEST_PAGES_PORT ?? 3157);
const BASE = `http://localhost:${PORT}`;

if (process.argv.includes("--build")) {
  const b = spawnSync("npx", ["next", "build"], { cwd: ROOT, stdio: "inherit" });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

// --- every page.tsx under src/app, as a URL with sample ids -----------------------------------
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : name === "page.tsx" ? [p] : [];
  });
}
function fill(segments) {
  const path = segments.join("/");
  return segments.map((s) => {
    if (!s.startsWith("[")) return s;
    const name = s.slice(1, -1);
    switch (name) {
      case "playerId": return ID.player;
      case "teamId": return ID.team;
      case "lineupId": return ID.lineup;
      case "gameId": return ID.game;
      case "quizId": return ID.quiz;
      case "planId": return ID.plan;
      case "scriptId": return ID.bullpenScript;
      case "spotlightId": return ID.spotlight;
      case "chapter": return path.includes("scorebook") ? "1" : "good-habits";
      case "lesson": return "why-leadership";
      case "n": return "1";
      case "slug": return "reset-breath";
      default: throw new Error(`No sample value for [${name}] in ${path}`);
    }
  });
}
const pages = walk(join(ROOT, "src/app"))
  .map((f) => relative(join(ROOT, "src/app"), f).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s)))
  .map((segs) => "/" + fill(segs).join("/"));
const routes = [
  ...new Set(pages),
  `/dugout/gameday/${ID.lineup}/pdf`,
  `/dugout/gameday/${ID.lineup}/pdf?card=umpire`,
  `/dugout/plans/${ID.plan}/pdf`,
].sort();

// --- run the built site in sample-data mode ---------------------------------------------------
const log = [];
const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  cwd: ROOT,
  env: { ...process.env, GGG_SAMPLE_DATA: "1", NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (d) => log.push(String(d)));
server.stderr.on("data", (d) => log.push(String(d)));
const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

async function ready() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${BASE}/login`);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("The server didn't start. Run `npm run build` first (or pass --build).");
}

const ERROR_MARKERS = ["__next_error__", "Application error"];

// A section that streams in late reports how it ended as $RX("id","digest"): a redirect (fine, unless
// to sign in), a client-side render bailout (empty digest, fine), a 404 or a real error (a hash).
function streamedProblem(body) {
  for (const m of body.matchAll(/\$RX\("[^"]*","([^"]*)"/g)) {
    const digest = m[1];
    if (digest === "") continue;
    if (digest.startsWith("NEXT_REDIRECT")) {
      if (digest.includes("/login")) return `redirected to sign in (${digest})`;
      continue;
    }
    if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) return "not found";
    return `error in a section (digest ${digest})`;
  }
  return null;
}

async function check(route) {
  const started = Date.now();
  const r = await fetch(BASE + route, { redirect: "manual" });
  const ms = Date.now() - started;
  const type = r.headers.get("content-type") ?? "";
  if (r.status >= 300 && r.status < 400) {
    const to = r.headers.get("location") ?? "";
    // a role-specific home (/me, /family, /mentor) may send the sample admin elsewhere; never to sign in
    return to.includes("/login") ? { route, ok: false, why: `redirected to sign in (${to})`, ms } : { route, ok: true, why: `→ ${to}`, ms };
  }
  if (r.status !== 200) return { route, ok: false, why: `HTTP ${r.status}`, ms };
  if (route.includes("/pdf")) return type.includes("application/pdf") ? { route, ok: true, ms } : { route, ok: false, why: `not a PDF (${type})`, ms };
  const body = await r.text();
  const marker = ERROR_MARKERS.find((m) => body.includes(m));
  if (marker) return { route, ok: false, why: `error in the page (${marker})`, ms };
  const streamed = streamedProblem(body);
  return streamed ? { route, ok: false, why: streamed, ms } : { route, ok: true, ms };
}

try {
  await ready();
  const results = [];
  for (let i = 0; i < routes.length; i += 6) results.push(...(await Promise.all(routes.slice(i, i + 6).map(check))));
  await new Promise((r) => setTimeout(r, 300));
  const serverErrors = log.join("").split("\n").filter((l) => /⨯|\bError:/.test(l));
  for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${String(r.ms).padStart(5)}ms  ${r.route}${r.why ? `  ${r.why}` : ""}`);
  const failed = results.filter((r) => !r.ok);
  if (serverErrors.length) console.log("\nServer errors:\n" + serverErrors.join("\n"));
  console.log(`\n${results.length - failed.length}/${results.length} pages ok${serverErrors.length ? `, ${serverErrors.length} server error lines` : ""}.`);
  stop();
  process.exit(failed.length || serverErrors.length ? 1 : 0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  stop();
  process.exit(1);
}
