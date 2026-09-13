// Probe: scroll to the bottom of a page, tap a nav/footer link, report where the next page settles.
// Each destination URL is tapped once from the first page linking to it; links back into the same
// document are tapped from every page that has them.
import { chromium } from 'playwright';
const PAGES = ['home', 'cb8', 'results', 'referral', 'about', 'partnership', 'brokers', 'blog', 'legal', 'blog/p/two-referral-links'];
const SEL = '#nav a[href], footer a[href]';
const browser = await chromium.launch();
for (const [tag, opts] of [['m', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }], ['d', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const seen = new Set();
  for (const p of PAGES) {
    const src = `http://localhost:5311/${p}/`;
    await page.goto(src, { waitUntil: 'networkidle' });
    const links = await page.evaluate(sel => [...document.querySelectorAll(sel)]
      .map(a => ({ h: a.getAttribute('href'), abs: a.href.split('#')[0] + (a.hash || '') }))
      .filter(l => l.h && l.h !== '#' && !/^https?:/.test(l.h)), SEL);
    for (const { h, abs } of links) {
      const same = abs.split(/[?#]/)[0] === src;
      if (!same && seen.has(abs)) continue;
      seen.add(abs);
      await page.goto(src, { waitUntil: 'networkidle' });
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(300);
      await page.evaluate(([sel, h]) => [...document.querySelectorAll(sel)].find(x => x.getAttribute('href') === h).click(), [SEL, h]);
      await page.waitForTimeout(200);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);   // short: a glide from the footer would still be under way
      const r = await page.waitForFunction(() => document.readyState === 'complete').then(() => page.evaluate(() => ({ url: location.pathname + location.search + location.hash, y: Math.round(scrollY), h: document.documentElement.scrollHeight })));
      console.log(`${r.y > 0 ? 'OFF' : 'top'} ${tag} ${p} -> ${h}: y=${r.y}/${r.h} at ${r.url}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log('done');
