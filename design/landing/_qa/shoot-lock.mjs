// QA pass for a hard-locked build (cb8): the window never scrolls, so step the section
// index with the page's own go(). Also runs the page self-check and reports overflow.
//   node design/landing/_qa/shoot-lock.mjs <url> <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const [url, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const errs = [];

async function pass(tag, width, height, pageUrl, locked) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', e => errs.push(`[${tag}] ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') errs.push(`[${tag}] ${m.text()}`);
    if (m.text().startsWith('CHECK')) console.log(`[${tag}] ${m.text()}`);
  });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const n = await page.evaluate(() => document.querySelectorAll('.screen').length);
  for (let i = 0; i < n; i++) {
    if (locked) await page.evaluate(i => window.__go(i), i);
    else await page.evaluate(i => document.querySelectorAll('.screen')[i].scrollIntoView(), i);
    // The longest reveal on the page is the week strip: .70s delay + .45s duration, and the
    // clock only starts once the smooth scroll has landed and .in is added. 1250ms caught it
    // mid-fade and made a screenshot look like a missing element.
    await page.waitForTimeout(2100);
    await page.screenshot({ path: join(outDir, `${tag}-${String(i + 1).padStart(2, '0')}.png`) });
  }
  const over = await page.evaluate(() => [...document.querySelectorAll('.screen')]
    .filter(s => s.scrollHeight > s.clientHeight + 2)
    .map(s => `${s.id} (${s.scrollHeight}>${s.clientHeight})`));
  if (over.length) console.log(`[${tag}] OVERFLOW: ${over.join(', ')}`);
  else console.log(`[${tag}] all ${n} screens fit one viewport`);
  await page.close();
}

await pass('d', 1440, 900, url + '?check=1', true);
await pass('s', 1280, 720, url + '?check=1', true);        // the short-laptop case
await pass('m', 390, 844, url + '?check=1', false);
await pass('r', 1440, 900, url + '?reduce=1&check=1', false);
await browser.close();
console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
