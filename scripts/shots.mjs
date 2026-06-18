// shots.mjs — one command to screenshot the whole UI gallery at desktop + iPhone
// width (and each modal on mobile), so you never type a Playwright command again.
//
//   npm run shots
//
// It boots the dev server, captures everything into screenshots/, then shuts down.
// Re-run it after touching any component to see the result instantly.

import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = "http://localhost:5173/gallery.html";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: "gallery-desktop", url: URL, w: 1200, h: 900, full: true },
  { name: "gallery-mobile", url: URL, w: 390, h: 844, full: true },
  { name: "modal-task-mobile", url: `${URL}?modal=task`, w: 390, h: 844 },
  { name: "modal-settings-mobile", url: `${URL}?modal=settings`, w: 390, h: 844 },
  { name: "modal-analytics-mobile", url: `${URL}?modal=analytics`, w: 390, h: 844 },
  { name: "modal-session-mobile", url: `${URL}?modal=session`, w: 390, h: 844 },
];

// Start the dev server (shell:true so `npm` resolves on macOS/nvm).
const dev = spawn("npm run dev", { stdio: "ignore", shell: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Poll through the browser until Vite is serving (handles localhost IPv6 binding).
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    try { await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 2000 }); ready = true; }
    catch { await page.waitForTimeout(500); }
  }
  await page.close();
  if (!ready) { console.error("dev server didn't come up"); dev.kill("SIGINT"); process.exit(1); }

  for (const s of SHOTS) {
    const p = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    await p.goto(s.url, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500); // let fonts + canvas settle
    await p.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: !!s.full });
    await p.close();
    console.log(`✓ ${OUT}/${s.name}.png`);
  }
  await browser.close();
  dev.kill("SIGINT");
  console.log(`\nDone → ${OUT}/`);
  process.exit(0);
})().catch(e => { console.error(e); dev.kill("SIGINT"); process.exit(1); });
