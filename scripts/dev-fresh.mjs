// dev-fresh.mjs — start Vite and open the app in a BRAND-NEW browser profile.
//
// Why: the Supabase session and the cached tasks live in the browser's
// localStorage, which a terminal script can't clear. So instead of clearing it,
// we launch Chrome with a throwaway --user-data-dir: empty storage = no session
// and no cached tasks = exactly what a first-time user sees. The temp profile is
// discarded by the OS, so every `npm run dev:fresh` is a clean slate.
//
// Run:  npm run dev:fresh
// Stop: Ctrl+C (also shuts the Vite server down).

import { spawn } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

const PORT = 5173;
const URL = `http://localhost:${PORT}`;

// 1. Start the Vite dev server (inherits stdio so you see its logs as usual).
const vite = spawn("npm", ["run", "dev"], { stdio: "inherit" });

// 2. Poll the port until Vite is accepting connections, then open the browser.
function waitForPort(tries = 0) {
  const sock = net.connect(PORT, "127.0.0.1");
  sock.once("connect", () => { sock.destroy(); openFreshBrowser(); });
  sock.once("error", () => {
    sock.destroy();
    if (tries > 150) { console.error("⚠️  Dev server didn't come up on", URL); return; }
    setTimeout(() => waitForPort(tries + 1), 200);
  });
}

function openFreshBrowser() {
  const profile = mkdtempSync(join(tmpdir(), "brainqueue-fresh-"));
  // Chrome / Chromium / Brave / Edge — first one found wins (macOS default paths).
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  const bin = candidates.find(existsSync);
  if (!bin) {
    console.log(`\n🧪 Dev server ready. Open a fresh INCOGNITO window at ${URL}`);
    console.log("   (No Chromium-based browser found at the default macOS paths.)");
    return;
  }
  const child = spawn(bin, [
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    URL,
  ], { stdio: "ignore", detached: true });
  child.on("error", () => console.log(`\n🧪 Open a fresh/incognito browser at ${URL}`));
  child.unref();
  console.log(`\n🧪 Fresh BrainQueue session (first-time user) — throwaway profile:\n   ${profile}`);
}

waitForPort();

// 3. Make Ctrl+C tear the Vite server down too.
const shutdown = () => { vite.kill("SIGINT"); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
vite.on("exit", (code) => process.exit(code ?? 0));
