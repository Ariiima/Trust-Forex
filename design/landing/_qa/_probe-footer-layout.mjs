// Scratch probe: where the footer's text lands, from the DOM, at a desktop, a tablet and a phone width.
//   node design/landing/_qa/_probe-footer-layout.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const w of [1280, 820, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1.25 });
  await p.goto('http://localhost:5311/home/?lock=off', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Reject all' }).click({ timeout: 2000 }).catch(() => {});
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(1500);
  const m = await p.evaluate(() => {
    const f = document.querySelector('.fsig'), top = f.getBoundingClientRect().top, R = el => el.getBoundingClientRect();
    const cols = [...document.querySelectorAll('.fsig-cols > div')].map(d => {
      const lis = [...d.querySelectorAll('li')].map(li => Math.round(R(li).top - top));
      return { x: Math.round(R(d.querySelector('h3')).left), h3: Math.round(R(d.querySelector('h3')).top - top), li: lis, right: Math.round(Math.max(...[...d.querySelectorAll('a')].map(a => R(a).right))) };
    });
    const overflow = document.documentElement.scrollWidth > innerWidth;
    return { mark: Math.round(R(document.querySelector('.fsig-mark')).left), say: Math.round(R(document.querySelector('.fsig-say')).left),
      rules: [...document.querySelectorAll('.fsig-rule')].map(r => Math.round(R(r).top - top)), cols, overflow, fsigH: Math.round(R(f).height) };
  });
  const r = await p.evaluate(() => { const r = document.querySelector('.fsig').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  const y = Math.max(0, Math.round(r.top - 20));
  await p.screenshot({ path: join(out, `home-${w}.png`), clip: { x: 0, y, width: w, height: Math.min(900, Math.round(r.bottom)) - y } });
  console.log(w, JSON.stringify(m));
  await p.close();
}
await b.close();
