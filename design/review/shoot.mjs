// Screenshot a local app route at an exact CSS size.
//   node design/review/shoot.mjs <url> <out.png> <width> <height> [waitMs]
// Height is the full frame height; the page is captured at that exact box so it
// lines up 1:1 with a cropped Figma frame reference.
import { chromium } from 'playwright';

const [url, out, w = '360', h = '852', wait = '900'] = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 1, // must stay 1: the Figma reference is 1 CSS px per px
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
console.log(`${out} ${w}x${h}`);
