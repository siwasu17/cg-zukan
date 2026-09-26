#!/usr/bin/env node
// Optional: take a screenshot of a catalogue and save it as its list-page thumbnail.
// Needs Playwright:  npm i -D playwright && npx playwright install chromium
//
//   node scripts/thumbnail.mjs <id>[:<n>] ...     → catalogues/<id>/thumbnail.png, and sets "thumbnail" in catalogues.json
//     <n> = which card to capture (0 = first card, default 0), e.g.  feel:0 pixel:14
//
// The server must be running in another terminal:  node scripts/serve.mjs
import { join } from 'node:path';
import { ROOT, readManifest, writeManifest } from './lib/manifest.mjs';

const ids = process.argv.slice(2);
if (!ids.length) { console.error('使い方: node scripts/thumbnail.mjs <id>[:<カード番号>] ...'); process.exit(1); }
let chromium;
try { ({ chromium } = await import('playwright')); } catch { console.error('Playwright が見つかりません: npm i -D playwright && npx playwright install chromium'); process.exit(1); }

const base = process.env.BASE_URL || 'http://localhost:8000/';
const m = readManifest();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
for (const arg of ids) {
  const [id, n = '0'] = arg.split(':');
  const c = m.catalogues.find((x) => x.id === id);
  if (!c) { console.warn(`${id}: catalogues.json にありません`); continue; }
  await page.goto(base + c.path, { waitUntil: 'load' });
  // each card's drawing area: canvas.stage (2D) or div.stage / div.stage3d (3D)
  const stage = page.locator('canvas.stage, .stage3d, div.stage').nth(Number(n));
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);
  const box = await stage.boundingBox();
  const h = Math.min(box.height, Math.round(box.width * 10 / 16));
  const out = join(ROOT, c.path, 'thumbnail.png');
  await page.screenshot({ path: out, clip: { x: box.x, y: box.y + (box.height - h) / 2, width: box.width, height: h } });
  c.thumbnail = c.path + 'thumbnail.png';
  console.log(`${id}: card ${n} → ${c.thumbnail}`);
}
await browser.close();
writeManifest(m);
