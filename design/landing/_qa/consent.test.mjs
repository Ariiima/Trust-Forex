// Cookie consent (cb8/consent.js), against the local landing server (_qa/serve.py): no banner on a
// first visit and nothing optional allowed, the dialog from the Cookie Settings tab, Reject all and
// Accept all as one click each, the choice kept across reloads and pages, Escape, a stale version,
// a phone, and the gate on scripts.
//   node design/landing/_qa/consent.test.mjs [http://localhost:5311]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.argv[2] || 'http://localhost:5311';
const b = await chromium.launch();

// Every context serves Home with one held analytics script planted in it, which counts its runs.
const fresh = async (viewport = { width: 1440, height: 900 }) => {
  const ctx = await b.newContext({ viewport });
  await ctx.route(/\/home\/(\?.*)?$/, async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace('</body>',
      '<script type="text/plain" data-consent="analytics">window.__ran = (window.__ran || 0) + 1</script></body>');
    await route.fulfill({ response: res, body });
  });
  return [ctx, await ctx.newPage()];
};
const stored = async ctx => {
  const c = (await ctx.cookies()).find(c => c.name === 'tf_consent');
  if (!c) return null;
  const { at, ...rest } = Object.fromEntries(new URLSearchParams(decodeURIComponent(c.value)));
  return rest;
};
const state = pg => pg.evaluate(() => ({ banner: !!document.querySelector('.cc-banner'),
  analytics: tfConsent.allowed('analytics'), marketing: tfConsent.allowed('marketing'), ran: window.__ran || 0 }));
const isOpen = pg => pg.locator('.cc-dialog').evaluate(d => d.open);
const NONE = { banner: false, analytics: false, marketing: false, ran: 0 };

// 1 — first visit: no banner, no dialog, nothing stored, nothing optional allowed or run
let [ctx, pg] = await fresh();
await pg.goto(base + '/home/', { waitUntil: 'load' });
assert.deepEqual(await state(pg), NONE);
assert.equal(await isOpen(pg), false);
assert.equal(await stored(ctx), null);

// 2 — the Cookie Settings tab says no choice is made and opens the dialog, all optional switches off,
//     with Reject all and Accept all the same size on one row
await pg.goto(base + '/legal/?document=cookies', { waitUntil: 'load' });
assert.equal(await pg.textContent('[data-consent-status]'), 'No choice made yet, so analytics and marketing are off.');
await pg.click('[data-consent-open]');
assert.equal(await isOpen(pg), true);
assert.equal(await pg.isChecked('#cc-analytics'), false);
assert.equal(await pg.isChecked('#cc-marketing'), false);
const [rej, acc] = await Promise.all(['reject', 'accept'].map(a => pg.locator(`.cc-dialog [data-cc="${a}"]`).boundingBox()));
assert.ok(Math.abs(rej.width - acc.width) < 1 && rej.height === acc.height && rej.y === acc.y,
  'Reject and Accept differ: ' + JSON.stringify({ rej, acc }));

// 3 — Reject all: one click; the choice is stored, shown, and kept on reload and on another page
await pg.click('.cc-dialog [data-cc="reject"]');
assert.equal(await isOpen(pg), false);
assert.deepEqual(await stored(ctx), { v: '1', analytics: '0', marketing: '0' });
assert.match(await pg.textContent('[data-consent-status]'), /^Your choice: Analytics off, Marketing off\. Saved \d+ \w+ \d{4}\.$/);
await pg.reload({ waitUntil: 'load' });
assert.match(await pg.textContent('[data-consent-status]'), /^Your choice: Analytics off, Marketing off\./);
await pg.goto(base + '/results/', { waitUntil: 'load' });
assert.equal(await pg.locator('.cc-banner').count(), 0, 'banner on another page');

// 4 — Escape closes without saving, and reopening shows the saved choice, not the abandoned one
await pg.goto(base + '/legal/?document=cookies', { waitUntil: 'load' });
await pg.click('[data-consent-open]');
await pg.check('#cc-analytics');
await pg.keyboard.press('Escape');
assert.equal(await isOpen(pg), false);
assert.deepEqual(await stored(ctx), { v: '1', analytics: '0', marketing: '0' });
await pg.click('[data-consent-open]');
assert.equal(await pg.isChecked('#cc-analytics'), false);

// 5 — Save choices keeps exactly what is switched on
await pg.check('#cc-analytics');
await pg.click('.cc-dialog [data-cc="save"]');
assert.equal(await isOpen(pg), false);
assert.deepEqual(await stored(ctx), { v: '1', analytics: '1', marketing: '0' });
assert.match(await pg.textContent('[data-consent-status]'), /Analytics on, Marketing off/);

// 6 — the gate: an allowed category's held script runs on load
await pg.goto(base + '/home/', { waitUntil: 'load' });
assert.deepEqual(await state(pg), { banner: false, analytics: true, marketing: false, ran: 1 });

// 7 — withdrawing a category whose script has run reloads the page, and the script is held after
await pg.evaluate(() => tfConsent.open());
await pg.uncheck('#cc-analytics');
await Promise.all([pg.waitForEvent('load'), pg.click('.cc-dialog [data-cc="save"]')]);
assert.deepEqual(await state(pg), NONE);
await ctx.close();

// 8 — Accept all releases the held script at once, without a reload
[ctx, pg] = await fresh();
await pg.goto(base + '/home/', { waitUntil: 'load' });
await pg.evaluate(() => tfConsent.open());
await pg.click('.cc-dialog [data-cc="accept"]');
assert.deepEqual(await state(pg), { banner: false, analytics: true, marketing: true, ran: 1 });
assert.deepEqual(await stored(ctx), { v: '1', analytics: '1', marketing: '1' });

// 9 — a choice saved under another VERSION does not count: everything optional is off again
await ctx.addCookies([{ name: 'tf_consent', value: encodeURIComponent('v=0&analytics=1&marketing=1&at=1'), url: base }]);
await pg.reload({ waitUntil: 'load' });
assert.deepEqual(await state(pg), NONE);
await ctx.close();

// 10 — a phone: no banner, and the dialog fits the screen
[ctx, pg] = await fresh({ width: 390, height: 844 });
await pg.goto(base + '/home/', { waitUntil: 'load' });
assert.deepEqual(await state(pg), NONE);
await pg.evaluate(() => tfConsent.open());
const dlg = await pg.locator('.cc-dialog').boundingBox();
assert.ok(dlg.y >= 0 && dlg.y + dlg.height <= 844 && dlg.x >= 0 && dlg.x + dlg.width <= 390, 'dialog off a phone: ' + JSON.stringify(dlg));
await ctx.close();

console.log('all checks pass');
await b.close();
