// One frame per screen of a landing page, tiled into a sheet: node _qa/screens.mjs <url> <out.png> [width=1440] [height=900]
// Each stop is a screen's own anchor (the hold's start), so held cards are shot pinned, plus a stop inside every hold.
import { chromium } from 'playwright';
const [url, out, w = '1440', h = '900', only = ''] = process.argv.slice(2);   // only: comma-separated frame numbers → one column, full size
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); if (/CHECK|CHART/.test(m.text())) console.log(m.text()); });
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
const stops = await p.evaluate(() => {
  const a = [...document.querySelectorAll('.scroll-anchor')];
  const ys = [];
  a.forEach((el, i) => {
    const y = el.getBoundingClientRect().top + scrollY;
    const s = el.nextElementSibling; const name = s.dataset.name || s.id;
    ys.push([name, y]);
    const hold = s.closest('.hold'); if (hold && !hold.classList.contains('beat')) ys.push([name + ' +hold', y + innerHeight * .6]);
  });
  ys.push(['end', document.documentElement.scrollHeight]);
  return ys;
});
const pick = only ? only.split(',').map(Number) : null;
const shots = [];
for (const [i, [name, y]] of stops.entries()) {
  if (pick && !pick.includes(i + 1)) continue;
  await p.evaluate(v => scrollTo(0, v), y); await p.waitForTimeout(1000);
  shots.push([name, (await p.screenshot()).toString('base64')]);
}
const overflow = await p.evaluate(() => [...document.querySelectorAll('.screen')].filter(s => s.scrollWidth > s.clientWidth + 2).map(s => s.id));
const sheet = await b.newPage({ viewport: { width: pick ? +w + 20 : 1520, height: 1000 } });
await sheet.setContent(`<style>body{margin:0;background:#20242c;color:#fff;font:500 12px ui-monospace,monospace}.g{display:grid;grid-template-columns:${pick ? '1fr' : '1fr 1fr'};gap:10px;padding:10px}.t{position:relative;border-radius:6px;overflow:hidden}.t img{width:100%;display:block}.t span{position:absolute;left:8px;top:8px;background:#000b;padding:4px 8px;border-radius:5px}</style><div class="g">${shots.map(([n, d], i) => `<div class="t"><span>${String(i + 1).padStart(2, '0')} · ${n}</span><img src="data:image/png;base64,${d}"></div>`).join('')}</div>`);
await sheet.waitForTimeout(500);
const hh = await sheet.evaluate(() => document.body.scrollHeight);
await sheet.setViewportSize({ width: pick ? +w + 20 : 1520, height: Math.min(hh, 8000) }); await sheet.waitForTimeout(300);
await sheet.screenshot({ path: out, fullPage: true });
console.log(`${shots.length} frames → ${out}`, overflow.length ? `\nOVERFLOW: ${overflow}` : '', errors.length ? `\nERRORS:\n${errors.join('\n')}` : '');
await b.close();
