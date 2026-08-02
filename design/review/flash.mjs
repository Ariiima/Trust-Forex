// Is there a blank frame during a client-side navigation?
//   node design/review/flash.mjs [baseUrl]
//
// Clicks each bottom-nav tab and samples frames across the swap. A "flash" is a
// frame where the outgoing screen has unmounted and the incoming one has not
// painted yet — you see the bare page background. Detected by compressed PNG
// size: a flat frame compresses to almost nothing, a real screen (header,
// cards, text, logos) never does. Ratio against the settled frame is the tell.
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5199';
const BLANK = 0.35; // below this share of the settled frame's bytes = blank
const SAMPLES = [16, 32, 64, 120, 200]; // ms after the click

const TABS = [
  ['Cashback', '/cashback'],
  ['Referrals', '/referral'],
  ['Earnings', '/earning'],
  ['Home', '/'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 776 }, deviceScaleFactor: 1 });
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

let worst = { label: '(none)', ratio: Infinity };

for (const [label, path] of TABS) {
  await page.getByRole('button', { name: label, exact: true }).click();

  const frames = [];
  let elapsed = 0;
  for (const t of SAMPLES) {
    await page.waitForTimeout(t - elapsed);
    elapsed = t;
    frames.push({ t, bytes: (await page.screenshot()).length });
  }

  await page.waitForTimeout(600);
  const settled = (await page.screenshot()).length;

  for (const f of frames) {
    const ratio = f.bytes / settled;
    if (ratio < worst.ratio) worst = { label: `${label} @${f.t}ms`, ratio };
    console.log(
      `${label.padEnd(10)} ${String(f.t).padStart(4)}ms  ${(ratio * 100).toFixed(0).padStart(4)}% of settled` +
        (ratio < BLANK ? '   <-- BLANK FRAME' : ''),
    );
  }
  const at = new URL(page.url()).pathname;
  console.log(`${label.padEnd(10)}  settled ${(settled / 1024).toFixed(0)}kB at ${at}${at === path ? '' : ` (expected ${path})`}\n`);
}

console.log(`worst: ${worst.label} at ${(worst.ratio * 100).toFixed(0)}% of settled — ${worst.ratio < BLANK ? 'FLASH' : 'no flash'}`);
await browser.close();
