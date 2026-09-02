// QA pass for one landing build: viewport screenshots at N scroll stops,
// desktop + mobile, plus a reduced-motion pass. Console errors are printed.
//   node design/landing/_qa/shoot.mjs <url> <outDir> [stops=10]
// Files: <outDir>/d-01.png … (1440×900), m-01.png … (390×844), r-01.png … (1440, ?reduce=1, 5 stops)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [url, outDir, stopsArg = '10'] = process.argv.slice(2);
if (!url || !outDir) { console.error('usage: shoot.mjs <url> <outDir> [stops]'); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const STOPS = Number(stopsArg);
const browser = await chromium.launch();

async function pass(tag, width, height, pageUrl, stops) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);                       // fonts + load intro
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  const max = Math.max(0, H - height);
  for (let i = 0; i < stops; i++) {
    const y = Math.round(max * (stops === 1 ? 0 : i / (stops - 1)));
    await page.evaluate(v => window.scrollTo(0, v), y);
    await page.waitForTimeout(900);                      // let scrubs settle
    const f = join(outDir, `${tag}-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: f });
  }
  console.log(`${tag}: ${width}x${height}, page ${H}px, ${stops} stops${errors.length ? '\n  errors: ' + errors.join('\n  ') : ''}`);
  await page.close();
}

const sep = url.includes('?') ? '&' : '?';
await pass('d', 1440, 900, url, STOPS);
await pass('m', 390, 844, url, STOPS);
await pass('r', 1440, 900, url + sep + 'reduce=1', 5);
await browser.close();
