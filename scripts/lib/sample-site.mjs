// The built site in sample-data mode (fictional data, signed in as a sample admin; see
// src/lib/supabase/sample/), shared by the page smoke test and the accessibility check.
import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { SAMPLE_IDS as ID } from "../../src/lib/supabase/sample/data.ts";

export const ROOT = new URL("../..", import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : name === "page.tsx" ? [p] : [];
  });
}

/** A sample value for each dynamic segment. A new [param] needs one here. */
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
      case "mentorId": return ID.mentor;
      case "chapter": return path.includes("scorebook") ? "1" : "good-habits";
      case "lesson": return "why-leadership";
      case "n": return "1";
      case "slug": return "reset-breath";
      default: throw new Error(`No sample value for [${name}] in ${path}`);
    }
  });
}

/** Every page.tsx under src/app as a URL with sample ids, sorted. */
export function samplePages() {
  const pages = walk(join(ROOT, "src/app"))
    .map((f) => relative(join(ROOT, "src/app"), f).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s)))
    .map((segs) => "/" + fill(segs).join("/"));
  // Leadership Light pages need a player in that program (Lila; Maya is in the Full program)
  const light = ["", "/light-what-is-a-leader", "/plan"].map((p) => `/players/${ID.lightLeader}/advanced/leadership${p}`);
  return [...new Set([...pages, ...light])].sort();
}

/** The PDF routes (not pages, so not found by samplePages). */
export const samplePdfRoutes = () => [
  `/dugout/gameday/${ID.lineup}/pdf`,
  `/dugout/gameday/${ID.lineup}/pdf?card=umpire`,
  `/dugout/plans/${ID.plan}/pdf`,
  // the parental consent form (Emma: the sample admin's daughter under 13)
  `/family/consent/${ID.consentPlayer}/pdf`,
];

/** Starts `next start` in sample-data mode; resolves once it answers. */
export async function startSampleSite(port) {
  const base = `http://localhost:${port}`;
  const log = [];
  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: ROOT,
    env: { ...process.env, GGG_SAMPLE_DATA: "1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => log.push(String(d)));
  server.stderr.on("data", (d) => log.push(String(d)));
  const stop = () => server.kill("SIGTERM");
  process.on("exit", stop);
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${base}/login`);
      if (r.status < 500) return { base, log, stop };
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  stop();
  throw new Error("The server didn't start. Run `npm run build` first (or pass --build).");
}
