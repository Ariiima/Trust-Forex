// Dump getBoundingClientRect for elements matching a selector, at the same
// viewport shoot.mjs uses. Beats inferring the box model from pixels.
//   node design/review/boxes.mjs <url> <height> <selector> [selector...]
import { chromium } from 'playwright';

const [url, h, ...sels] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 360, height: Number(h) },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
for (const sel of sels) {
  const rows = await page.$$eval(sel, (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        pad: cs.padding, gap: cs.gap, lh: cs.lineHeight, fs: cs.fontSize,
      };
    }),
  );
  console.log(sel);
  for (const r of rows) console.log('  ', JSON.stringify(r));
}
await browser.close();
