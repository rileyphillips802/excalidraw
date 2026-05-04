/**
 * Records a short demo of the Undo History Panel (Playwright video).
 *
 * Prerequisites: `npx playwright install chromium` once, dev server running.
 *
 *   yarn --cwd excalidraw-app start --host 127.0.0.1 --port 3000
 *   VITE_URL=http://127.0.0.1:3000 node scripts/record-undo-history-demo.mjs
 *
 * Outputs WebM under tmp/ and an H.264 MP4 next to it if ffmpeg is available.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const baseURL = process.env.VITE_URL || "http://127.0.0.1:3000";
const outDir = path.join(rootDir, "tmp", "undo-history-panel-demo");
const outWebm = path.join(outDir, "undo-history-panel-demo.webm");
const outMp4 = path.join(outDir, "undo-history-panel-demo.mp4");

fs.mkdirSync(outDir, { recursive: true });

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
});

const page = await context.newPage();
page.setDefaultTimeout(60000);

try {
  await page.goto(baseURL, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("canvas.excalidraw__canvas", { state: "visible" });
  await delay(800);

  const canvas = page.locator("canvas.excalidraw__canvas").first();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Canvas bounding box not found");
  }

  const rectTool = page.locator('[data-testid="toolbar-rectangle"]').first();
  try {
    await rectTool.click({ timeout: 4000 });
  } catch {
    await page.keyboard.press("Digit2");
  }
  await delay(200);

  const cx = box.x + box.width * 0.35;
  const cy = box.y + box.height * 0.35;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 180, cy + 120);
  await page.mouse.up();
  await delay(400);

  await page.mouse.move(cx + 220, cy + 40);
  await page.mouse.down();
  await page.mouse.move(cx + 320, cy + 140);
  await page.mouse.up();
  await delay(400);

  await page.keyboard.press("Control+Shift+KeyH");
  await delay(1200);

  const panel = page.locator(".history-panel");
  if ((await panel.count()) > 0) {
    await panel.first().evaluate((el) => el.scrollTo?.(0, 0));
  }
  await delay(800);

  const menuTrigger = page.locator('[data-testid="main-menu-trigger"]').first();
  await menuTrigger.click();
  await delay(500);
  const historyItem = page.locator('[data-testid="history-panel-button"]');
  if ((await historyItem.count()) > 0) {
    await historyItem.first().waitFor({ state: "visible", timeout: 10000 });
    await historyItem.first().hover();
    await delay(800);
  }
  await page.keyboard.press("Escape");
  await delay(400);

  await page.keyboard.press("Control+z");
  await delay(600);
  await page.keyboard.press("Control+Shift+z");
  await delay(800);
} finally {
  await context.close();
  await browser.close();
}

const files = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith(".webm"))
  .map((f) => ({
    name: f,
    time: fs.statSync(path.join(outDir, f)).mtimeMs,
  }))
  .sort((a, b) => b.time - a.time);

if (files.length === 0) {
  console.error("No webm video found in", outDir);
  process.exit(1);
}

const latest = path.join(outDir, files[0].name);
if (latest !== outWebm) {
  try {
    fs.unlinkSync(outWebm);
  } catch {
    /* ignore */
  }
  fs.renameSync(latest, outWebm);
}
console.log("Wrote", outWebm);

try {
  execSync(
    `ffmpeg -y -i "${outWebm}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -an "${outMp4}"`,
    { stdio: "inherit" },
  );
  console.log("Wrote", outMp4);
} catch {
  console.warn("ffmpeg not available or conversion failed; WebM only.");
}
