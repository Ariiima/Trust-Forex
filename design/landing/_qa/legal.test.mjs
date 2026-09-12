// The Legal Center's four rules, checked against the local landing server (_qa/serve.py):
// the document switch and its history, the no-JS fallback, the flattened headings, and the
// sticky tab bar on a phone.
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

// 3 — every heading in a document is body size and body ink
await pg.goto(base + '?document=terms', { waitUntil: 'networkidle' });
const off = await pg.evaluate(() => {
  const p = getComputedStyle(document.querySelector('.doc:not([hidden]) p'));
  return [...document.querySelectorAll('.doc:not([hidden]) h2,.doc:not([hidden]) h3,.doc:not([hidden]) h4')]
    .map(h => { const s = getComputedStyle(h); return { t: h.textContent.slice(0, 24), size: s.fontSize, color: s.color }; })
    .filter(h => h.size !== p.fontSize || h.color !== p.color);
});
assert.deepEqual(off, [], 'headings off the body size/colour: ' + JSON.stringify(off));

// 4 — nothing numbered survived
const numbered = await pg.$$eval('.doc h2,.doc h3,.doc h4,.doc-tabs a',
  e => e.map(x => x.textContent.trim()).filter(t => /^\d/.test(t)));
assert.deepEqual(numbered, [], 'numbered headings: ' + numbered);

// 5 — the tab bar stays under the nav on a phone, on one line
const ph = await b.newPage({ viewport: { width: 390, height: 844 } });
await ph.goto(base + '?document=terms', { waitUntil: 'networkidle' });
await ph.evaluate(() => window.scrollTo(0, 2500));
await ph.waitForTimeout(200);
const bar = await ph.evaluate(() => {
  const r = document.querySelector('.doc-tabs').getBoundingClientRect();
  const row = document.querySelector('.doc-tabs-row');
  return { top: Math.round(r.top), height: Math.round(r.height), lines: row.scrollHeight > 44 ? 2 : 1 };
});
assert.equal(bar.top, 56, 'tab bar not stuck: ' + JSON.stringify(bar));
assert.equal(bar.lines, 1, 'tab bar wrapped on a phone: ' + JSON.stringify(bar));
console.log('all checks pass', JSON.stringify(bar));
await b.close();
