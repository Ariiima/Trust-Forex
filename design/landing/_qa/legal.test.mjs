// The Legal Center's four rules, checked against the local landing server (_qa/serve.py):
// the document switch and its history, the no-JS fallback, the heading hierarchy,
// the blue head over the white sheet, and the sticky document links on a phone.
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

// 4 — the look (founder, 2026-09-16: blue head, paper grid, one white sheet): the band is the site's blue,
// the sheet is white and rises into the band, and the tab bar is clear on the band and white once stuck,
// with its text white while clear and navy once filled.
const look = await pg.evaluate(() => {
  const top = document.querySelector('.legal-top'), sheet = document.querySelector('.legal-body .legal-wrap');
  return {
    band: getComputedStyle(top).backgroundColor,
    sheet: getComputedStyle(sheet).backgroundColor,
    rises: Math.round(top.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top) > 0,
    grid: getComputedStyle(document.querySelector('.legal'), '::before').backgroundImage.includes('repeating-linear-gradient'),
  };
});
assert.deepEqual(look, { band: 'rgb(12, 46, 123)', sheet: 'rgb(255, 255, 255)', rises: true, grid: true }, 'look: ' + JSON.stringify(look));
const barAt = async y => { await pg.evaluate(y => scrollTo(0, y), y); await pg.waitForTimeout(250); return pg.evaluate(() => {
  const bar = document.querySelector('.doc-tabs');
  return { p: +getComputedStyle(bar).getPropertyValue('--p'), clear: bar.classList.contains('is-clear'),
    tab: getComputedStyle(bar.querySelector('[aria-current="page"]')).color };
}); };
const stickAt = await pg.evaluate(() => document.querySelector('.doc-tabs').getBoundingClientRect().top -
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')));
assert.deepEqual(await barAt(0), { p: 0, clear: true, tab: 'rgb(255, 255, 255)' }, 'bar at the top');
const half = await barAt(stickAt + 36);
assert.ok(half.p > .4 && half.p < .6 && !half.clear, 'bar halfway: ' + JSON.stringify(half));
assert.deepEqual(await barAt(stickAt + 200), { p: 1, clear: false, tab: 'rgb(9, 34, 92)' }, 'bar filled');
await pg.evaluate(() => scrollTo(0, 0));

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
// the sheet stays inside the screen on a phone
const edges = await ph.evaluate(() => { const r = document.querySelector('.legal-body .legal-wrap').getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(innerWidth - r.right), scroll: document.documentElement.scrollWidth - innerWidth }; });
assert.deepEqual(edges, { left: 12, right: 12, scroll: 0 }, 'sheet on a phone: ' + JSON.stringify(edges));
console.log('all checks pass', JSON.stringify(bar));
await b.close();
