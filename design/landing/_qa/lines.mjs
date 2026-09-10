// Heading line counts, wireframe vs build, at one width: node _qa/lines.mjs <wireframe file> <built url> [width]
// Headings are matched by text; a mismatch means the built page breaks a line the wireframe does not (or vice versa).
import { chromium } from 'playwright';
const [wf, url, width = '1440'] = process.argv.slice(2);
const b = await chromium.launch();
const grab = async u => {
  const p = await b.newPage({ viewport: { width: +width, height: 900 } });
  await p.goto(u); await p.waitForTimeout(700);
  const r = await p.evaluate(() => [...document.querySelectorAll('h1,h2,h3,.display-support')].map(h => {
    const cs = getComputedStyle(h); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const ws = [...h.querySelectorAll('.w')]; const tops = new Set(ws.map(w => Math.round(w.getBoundingClientRect().top)));
    const lines = ws.length ? tops.size : Math.round((h.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lh);
    return [h.textContent.replace(/\s+/g, ' ').trim(), lines, Math.round(parseFloat(cs.fontSize)), Math.round(h.getBoundingClientRect().width)];
  }));
  await p.close(); return r;
};
const a = await grab(wf), bb = await grab(url);
const built = new Map(bb.map(([t, ...r]) => [t, r]));
let bad = 0;
for (const [t, lines, size, w] of a) {
  const m = built.get(t); if (!m) { console.log(`  (not in build) ${t}`); continue; }
  const flag = m[0] !== lines || m[1] !== size; if (flag) bad++;
  console.log(`${flag ? '✗' : '✓'} ${t.slice(0, 60).padEnd(60)} wf ${lines}L ${size}px ${w}w | built ${m[0]}L ${m[1]}px ${m[2]}w`);
}
console.log(bad ? `${bad} mismatches` : 'all headings match');
await b.close();
