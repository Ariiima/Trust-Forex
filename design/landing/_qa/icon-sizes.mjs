// Every icon glyph — the Iconly .ico slots and the Brokers market chips — renders at --icon-size, and every
// box an icon sits in renders at --icon-well. This walks every page at desktop and mobile widths and fails
// on any rendered glyph or box of another size. A box is the .ico itself when it carries padding, else its
// parent when that is smaller than 64px; an icon with neither sits in text and has no box. Computed sizes,
// so reveal transforms do not skew them; slots that are not rendered (a form's success state) are skipped.
// Inline glyphs inside text (arrows, socials, plan ticks) are printed for reference, not checked.
//   node design/landing/_qa/icon-sizes.mjs [http://localhost:5311] [--all]
import { chromium } from 'playwright';
const base = process.argv.find(a => a.startsWith('http')) || 'http://localhost:5311';
const all = process.argv.includes('--all');
const b = await chromium.launch();
const pages = ['home', 'cb8', 'results', 'referral', 'about', 'partnership', 'brokers', 'legal', 'blog', 'blog/p/how-we-measure-a-signal'];
const rows = new Map();
let bad = 0, seen = 0;
for (const vw of [1280, 390]) {
  const pg = await b.newPage({ viewport: { width: vw, height: 900 } });
  for (const p of pages) {
    await pg.goto(`${base}/${p}/`, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(800);
    const found = await pg.evaluate(() => {
      const root = getComputedStyle(document.documentElement), rem = parseFloat(root.fontSize);
      const token = parseFloat(root.getPropertyValue('--icon-size')) * rem, well = parseFloat(root.getPropertyValue('--icon-well')) * rem;
      const px = (el, k) => Math.round(parseFloat(getComputedStyle(el)[k]) * 10) / 10;
      const shown = el => el.getClientRects().length > 0;
      const name = el => [...el.classList].find(c => !/^(ico|rv|in|tile|ico-(success|warning|light|bold|two-tone))$/.test(c)) || el.tagName.toLowerCase();
      const out = [];
      const add = (glyph, box, kind) => {
        out.push({ check: true, kind, slot: name(box || glyph.closest('.ico') || glyph.parentElement), w: px(glyph, 'width'), h: px(glyph, 'height'), want: token });
        if (box) out.push({ check: true, kind: 'well', slot: name(box), w: px(box, 'width'), h: px(box, 'height'), want: well });
      };
      document.querySelectorAll('.ico').forEach(el => {
        const svg = el.querySelector('svg:last-child');
        if (!svg || !shown(svg)) return;
        const padded = parseFloat(getComputedStyle(el).paddingLeft) > 0, parent = el.parentElement;
        add(svg, padded ? el : parseFloat(getComputedStyle(parent).width) < 64 ? parent : null, 'ico');
      });
      document.querySelectorAll('.market-chip svg').forEach(s => shown(s) && add(s, s.parentElement, 'market'));
      for (const [kind, sel] of [['social', '.social svg'], ['fsig-chan', '.fsig-chan svg'], ['linkedin', '.linkedin > svg:not(.ext)'], ['ext-arrow', 'svg.ext'], ['plan-tick', '.plan-tick']])
        document.querySelectorAll(sel).forEach(s => shown(s) && out.push({ check: false, kind, slot: [...s.closest('[class]:not(svg)').classList][0], w: px(s, 'width'), h: px(s, 'height') }));
      return out;
    });
    for (const r of found) {
      const ok = !r.check || (r.w === r.want && r.h === r.want);
      if (r.check) { seen++; if (!ok) bad++; }
      const key = `${vw}|${r.kind}|${r.slot}|${r.w}x${r.h}`;
      const row = rows.get(key) || { vw, ...r, ok, pages: new Set(), n: 0 };
      row.n++; row.pages.add(p); rows.set(key, row);
    }
  }
  await pg.close();
}
await b.close();
for (const r of [...rows.values()].sort((a, b) => a.vw - b.vw || b.check - a.check || a.kind.localeCompare(b.kind) || b.w - a.w)) {
  if (!all && r.ok) continue;
  const mark = !r.check ? '   ' : r.ok ? 'ok ' : 'BAD';
  console.log(`${mark} ${r.vw}\t${r.kind.padEnd(10)}\t${String(r.w + 'x' + r.h).padEnd(9)}\t${String(r.n).padStart(3)}\t${r.slot.padEnd(20)}\t${[...r.pages].join(',')}`);
}
console.log(`${seen} icon glyphs and boxes, ${bad} not at --icon-size / --icon-well`);
process.exit(bad ? 1 : 0);
