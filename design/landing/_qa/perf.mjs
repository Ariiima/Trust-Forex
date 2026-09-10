// frame-time harness: flick through every screen in soft mode, count long frames per hop.
//   node design/landing/_qa/perf.mjs [label] [css-to-inject]
import { chromium } from 'playwright';
const [label = 'baseline', css = ''] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:5311/cb8/?lock=soft', { waitUntil: 'networkidle' });
if (css) await p.addStyleTag({ content: css });
await p.waitForTimeout(500); await p.mouse.move(720, 500);
await p.evaluate(() => {
  window.__frames = []; let last = performance.now();
  const loop = t => { window.__frames.push(t - last); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
const n = await p.evaluate(() => document.querySelectorAll('.screen').length);
const rows = []; let totalLong = 0;
for (let i = 0; i < n - 1; i++) {
  await p.evaluate(() => { window.__frames.length = 0; });
  for (let k = 0; k < 12; k++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(12); }
  await p.waitForTimeout(1400);
  const f = await p.evaluate(() => window.__frames.slice());
  const long = f.filter(x => x > 20).length, max = Math.max(...f);
  totalLong += long;
  const idx = await p.evaluate(() => [...document.querySelectorAll('.dot')].findIndex(d => d.getAttribute('aria-current') === 'true'));
  rows.push(`  ->${String(idx).padStart(2)}: ${String(long).padStart(3)} long, max ${max.toFixed(0).padStart(3)}ms`);
}
console.log(`${label}: ${totalLong} long frames total\n` + rows.slice(0, 6).join('\n'));
await b.close();
