// The Legal Center's four rules, checked against the local landing server (_qa/serve.py):
// the document switch and its history, the no-JS fallback, the heading hierarchy, black and
// white, and the sticky document links on a phone.
//   node design/landing/_qa/legal.test.mjs [http://localhost:5311]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = (process.argv[2] || 'http://localhost:5311') + '/legal/';
const b = await chromium.launch();

// 1 — tab click switches, pushes history, Back returns
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto(base, { waitUntil: 'networkidle' });
assert.deepEqual(await pg.$$eval('[data-doc]:not([hidden])', e => e.map(x => x.dataset.doc)), ['terms']);
await pg.click('[data-tab="privacy"]');
await pg.waitForTimeout(200);
assert.deepEqual(await pg.$$eval('[data-doc]:not([hidden])', e => e.map(x => x.dataset.doc)), ['privacy']);
assert.match(pg.url(), /\?document=privacy$/);
assert.equal(await pg.title(), 'Privacy Policy — TrustForex');
await pg.goBack();
await pg.waitForTimeout(200);
assert.deepEqual(await pg.$$eval('[data-doc]:not([hidden])', e => e.map(x => x.dataset.doc)), ['terms']);
// the footer's legal column switches in place too
await pg.click('.fsig-cols a[href="?document=risk"]');
await pg.waitForTimeout(200);
assert.deepEqual(await pg.$$eval('[data-doc]:not([hidden])', e => e.map(x => x.dataset.doc)), ['risk']);
// an unknown ?document= falls back to the first document
await pg.goto(base + '?document=nonsense', { waitUntil: 'networkidle' });
assert.deepEqual(await pg.$$eval('[data-doc]:not([hidden])', e => e.map(x => x.dataset.doc)), ['terms']);

// 2 — without JS every document is readable, in order
const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
const plain = await ctx.newPage();
await plain.goto(base + '?document=privacy', { waitUntil: 'load' });
assert.deepEqual(await plain.$$eval('[data-doc]:not([hidden])', e => e.map(x => x.dataset.doc)),
  ['terms', 'risk', 'privacy', 'cookies']);
const chars = await plain.evaluate(() => document.querySelector('.legal-body').innerText.length);
assert.ok(chars > 50000, 'no-JS text present: ' + chars);

// 3 — a standard hierarchy: document title > section heading > subheading = body. The document
// title is off screen once a tab is open (the tab names it), and nothing sits between the tabs
// and the first section.
await pg.goto(base + '?document=terms', { waitUntil: 'networkidle' });
const size = await pg.evaluate(() => Object.fromEntries(['h2', 'h3', 'h4', '.group p'].map(s =>
  [s, parseFloat(getComputedStyle(document.querySelector('.doc:not([hidden]) ' + s)).fontSize)])));
assert.ok(size.h2 > size.h3 && size.h3 > size.h4 && size.h4 === size['.group p'],
  'hierarchy: ' + JSON.stringify(size));
const head = await pg.evaluate(() => ({
  h2: document.querySelector('.doc:not([hidden]) h2').getBoundingClientRect().height,
  extra: document.querySelectorAll('.legal-top .label, .doc-lede, .doc-meta').length,
}));
assert.deepEqual(head, { h2: 1, extra: 0 }, 'document head still shown: ' + JSON.stringify(head));

// 4 — black and white: no computed colour above the footer has a hue — text, grounds, rims,
// gradients and shadows, pseudo-elements included. The footer is the house footer, blue glass as on
// every page (founder, 2026-09-14), so it is left out.
const hued = await pg.evaluate(() => {
  const props = ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'fill', 'stroke', 'backgroundImage', 'boxShadow'];
  const out = new Set();
  for (const el of document.querySelectorAll('body *')) if (!el.closest('.footer-only')) for (const pseudo of [null, '::before', '::after']) {
    const s = getComputedStyle(el, pseudo);
    for (const k of props) for (const m of s[k].matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/g)) {
      if (!(m[1] === m[2] && m[2] === m[3])) { out.add(`${el.localName}.${el.getAttribute('class')}${pseudo || ''} ${k} ${s[k].slice(0, 90)}`); break; }
    }
  }
  return [...out];
});
assert.deepEqual(hued, [], 'coloured: ' + hued.join(' | '));

// 5 — nothing numbered survived
const numbered = await pg.$$eval('.doc h2,.doc h3,.doc h4,.doc-tabs a',
  e => e.map(x => x.textContent.trim()).filter(t => /^\d/.test(t)));
assert.deepEqual(numbered, [], 'numbered headings: ' + numbered);

// 6 — the document links stay under the nav on a phone, on one line
const ph = await b.newPage({ viewport: { width: 390, height: 844 } });
await ph.goto(base + '?document=terms', { waitUntil: 'networkidle' });
await ph.evaluate(() => window.scrollTo(0, 2500));
await ph.waitForTimeout(200);
const bar = await ph.evaluate(() => {
  const r = document.querySelector('.doc-tabs').getBoundingClientRect();
  const links = [...document.querySelectorAll('.doc-tabs-row a')];
  return { top: Math.round(r.top), height: Math.round(r.height), lines: new Set(links.map(a => a.offsetTop)).size };
});
assert.equal(bar.top, 56, 'tab bar not stuck: ' + JSON.stringify(bar));
assert.equal(bar.lines, 1, 'tab bar wrapped on a phone: ' + JSON.stringify(bar));
console.log('all checks pass', JSON.stringify(bar));
await b.close();
