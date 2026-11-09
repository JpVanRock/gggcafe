// A small headless-Chrome driver over the DevTools protocol (Node's built-in WebSocket), so
// checks can load real pages without a browser-automation dependency. Chrome comes from
// CHROME_PATH, or the usual install locations (GitHub's Ubuntu runners have google-chrome).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

export function findChrome() {
  const path = process.env.CHROME_PATH || CANDIDATES.find((p) => existsSync(p));
  if (!path) throw new Error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium executable.");
  return path;
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const sock = new WebSocket(url);
    let next = 0;
    const waiting = new Map();
    const listeners = new Set();
    sock.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && waiting.has(msg.id)) {
        const { ok, fail } = waiting.get(msg.id);
        waiting.delete(msg.id);
        if (msg.error) fail(new Error(msg.error.message));
        else ok(msg.result);
      } else for (const l of listeners) l(msg);
    };
    sock.onerror = () => reject(new Error("Couldn't connect to Chrome."));
    sock.onopen = () =>
      resolve({
        send(method, params = {}, sessionId) {
          const id = ++next;
          sock.send(JSON.stringify({ id, method, params, sessionId }));
          return new Promise((ok, fail) => waiting.set(id, { ok, fail }));
        },
        on(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        close: () => sock.close(),
      });
  });
}

/** Starts headless Chrome; `newPage()` opens a tab, `close()` shuts it all down. */
export async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "ggg-chrome-"));
  const args = [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--mute-audio",
    // CI runners don't allow Chrome's sandbox (no unprivileged user namespaces)
    ...(process.env.CI ? ["--no-sandbox"] : []),
    "about:blank",
  ];
  const proc = spawn(findChrome(), args, { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error("Chrome didn't start.")), 20000);
    proc.stderr.on("data", (d) => {
      out += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    proc.on("error", (e) => reject(new Error(`Couldn't start Chrome (${e.message}). Set CHROME_PATH.`)));
    proc.on("exit", (code) => reject(new Error(`Chrome exited (${code}): ${out.slice(-400)}`)));
  });
  const cdp = await connect(wsUrl);

  async function newPage({ width = 1280, height = 900, mobile = false, theme = "night" } = {}) {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    // the root layout's boot script reads this before the page paints (tabs share one profile, so
    // Night Game clears what a Day Game tab set)
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: theme === "day" ? "try{localStorage.setItem('ggg-theme','day')}catch(e){}" : "try{localStorage.removeItem('ggg-theme')}catch(e){}",
    });
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    return {
      evaluate,
      async goto(url) {
        const loaded = new Promise((resolve) => {
          const timer = setTimeout(done, 30000);
          const off = cdp.on((msg) => msg.sessionId === sessionId && msg.method === "Page.loadEventFired" && done());
          function done() {
            clearTimeout(timer);
            off();
            resolve();
          }
        });
        await send("Page.navigate", { url });
        await loaded;
        // let a client-side redirect happen, then wait for streamed sections to swap in (and no
        // loading placeholder left); a redirect mid-check throws, so just look again
        await new Promise((r) => setTimeout(r, 600));
        for (let i = 0; i < 50; i++) {
          const ready = await evaluate(
            "(window.$RB && window.$RB.length && window.$RV ? window.$RV(window.$RB) : 0, document.readyState === 'complete' && !document.querySelector('[role=status][aria-busy=true]'))",
          ).catch(() => false);
          if (ready) break;
          await new Promise((r) => setTimeout(r, 200));
        }
      },
      /** A PNG (Buffer) of the page from the top, `maxHeight` px at most. */
      async screenshot(maxHeight = 3000) {
        const { cssContentSize } = await send("Page.getLayoutMetrics");
        const clip = { x: 0, y: 0, width, height: Math.min(Math.ceil(cssContentSize.height), maxHeight), scale: 1 };
        const { data } = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
        return Buffer.from(data, "base64");
      },
      close: () => cdp.send("Target.closeTarget", { targetId }),
    };
  }

  return {
    newPage,
    /** Stops Chrome, waits for it to exit, then removes its throwaway profile (cleanup never fails a check). */
    async close() {
      cdp.close();
      if (proc.exitCode === null) {
        const exited = new Promise((resolve) => proc.once("exit", resolve));
        proc.kill();
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
      }
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {}
    },
  };
}
