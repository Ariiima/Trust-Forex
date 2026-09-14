// Scratch probe: the footer pane on a blue floor (home), a paper floor (blog) and a black one (legal),
// at rest and with the pointer over the CTA.
//   node design/landing/_qa/_probe-footer-glass.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const pages = [['home', 'home/?'], ['blog', 'blog/?'], ['legal', 'legal/?document=terms&']];
const b = await chromium.launch();
for (const [name, path] of pages) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.25 });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(`http://localhost:5311/${path}lock=off`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Reject all' }).click({ timeout: 2000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(1800);
  const rect = await p.evaluate(() => { const r = document.querySelector('.fsig').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  const y = Math.max(0, Math.round(rect.top - 140));
  const clip = { x: 0, y, width: 1280, height: Math.min(900, Math.round(rect.bottom)) - y };
  await p.screenshot({ path: join(out, `${name}.png`), clip });
  const cta = await p.evaluate(() => { const r = document.querySelector('.fsig-cta').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2 }; });
  await p.mouse.move(cta.x - 260, cta.y + 60);
  await p.mouse.move(cta.x + 40, cta.y + 18, { steps: 12 });
  await p.waitForTimeout(700);
  const lit = await p.evaluate(() => { const f = document.querySelector('.fsig'); return { lit: f.classList.contains('lit'), mx: f.style.getPropertyValue('--mx') }; });
  await p.screenshot({ path: join(out, `${name}-hover.png`), clip });
  console.log(name, JSON.stringify(rect), JSON.stringify(lit), errors.length ? 'errors: ' + errors.join(' | ') : '');
  await p.close();
}
await b.close();
