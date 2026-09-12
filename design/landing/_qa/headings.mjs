// Every display heading takes one of two gradient runs (cb8/style.css --grad): the light run on a blue
// ground, the blue run on paper. The run is inherited from whatever paints the ground; the heading's own
// colour (white on blue, navy on paper) comes from the page's older colour rules — two independent
// sources that must agree. This walks every page and fails on any heading where they don't, or where a
// heading has no run at all.   node design/landing/_qa/headings.mjs [http://localhost:5311]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:5311';
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const pages = ['cb8', 'results', 'referral', 'about', 'partnership', 'brokers', 'blog'];
await pg.goto(`${base}/blog/`, { waitUntil: 'networkidle' });
const post = await pg.evaluate(() => document.querySelector('a[href^="p/"]')?.getAttribute('href'));
if (post) pages.push('blog/' + post.replace(/\/?$/, ''));
let bad = 0, seen = 0;
for (const p of pages) {
  await pg.goto(`${base}/${p}/`, { waitUntil: 'networkidle' });
  const rows = await pg.evaluate(() => [...document.querySelectorAll('.display,.h2,h3.words')].map(h => {
    const i = h.querySelector('.w i') || h; const cs = getComputedStyle(i);
    const light = /rgb\(255, 255, 255\)/.test(cs.backgroundImage), run = cs.backgroundImage === 'none' ? 'none' : light ? 'light' : 'blue';
    const white = cs.color === 'rgb(255, 255, 255)';
    return { id: h.id || h.closest('section')?.id || '?', text: h.textContent.trim().slice(0, 40), run, colour: white ? 'white' : cs.color, ok: run === (white ? 'light' : 'blue') };
  }));
  for (const r of rows) { seen++; if (!r.ok) { bad++; console.log(`${p.padEnd(12)} #${r.id.padEnd(16)} ${r.run.padEnd(5)} on ${r.colour.padEnd(18)} ${r.text}`); } }
}
await b.close();
console.log(`${seen} headings, ${bad} mismatched`);
process.exit(bad ? 1 : 0);
