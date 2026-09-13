// Cookie consent (cb8/consent.js), against the local landing server (_qa/serve.py): the banner on a
// first visit, Reject all and Accept all as one click each, the choice kept across reloads and pages,
// the dialog from the Cookie Settings tab, Escape, a stale version, a phone, and the gate on scripts.
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

// 1 — first visit: the banner, on screen, nothing stored, nothing optional allowed or run
let [ctx, pg] = await fresh();
await pg.goto(base + '/home/', { waitUntil: 'load' });
assert.deepEqual(await state(pg), { banner: true, analytics: false, marketing: false, ran: 0 });
assert.equal(await stored(ctx), null);
const box = await pg.locator('.cc-banner').boundingBox();
assert.ok(box.x >= 0 && box.y + box.height <= 900, 'banner off screen: ' + JSON.stringify(box));
const [rej, acc] = await Promise.all(['reject', 'accept'].map(a => pg.locator(`.cc-banner [data-cc="${a}"]`).boundingBox()));
assert.ok(Math.abs(rej.width - acc.width) < 1 && rej.height === acc.height && rej.y === acc.y,
  'Reject and Accept differ: ' + JSON.stringify({ rej, acc }));

// 2 — Reject all: one click; the banner goes, and stays gone on reload and on another page
await pg.click('.cc-banner [data-cc="reject"]');
assert.deepEqual(await state(pg), { banner: false, analytics: false, marketing: false, ran: 0 });
assert.deepEqual(await stored(ctx), { v: '1', analytics: '0', marketing: '0' });
await pg.reload({ waitUntil: 'load' });
assert.deepEqual(await state(pg), { banner: false, analytics: false, marketing: false, ran: 0 });
await pg.goto(base + '/results/', { waitUntil: 'load' });
assert.equal(await pg.locator('.cc-banner').count(), 0, 'banner back on another page');

// 3 — the Cookie Settings tab shows the saved choice and opens the dialog on it
await pg.goto(base + '/legal/?document=cookies', { waitUntil: 'load' });
assert.match(await pg.textContent('[data-consent-status]'), /^Your choice: Analytics off, Marketing off\. Saved \d+ \w+ \d{4}\.$/);
await pg.click('[data-consent-open]');
assert.equal(await isOpen(pg), true);
assert.equal(await pg.isChecked('#cc-analytics'), false);

// 4 — Escape closes without saving, and reopening shows the saved choice, not the abandoned one
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
assert.deepEqual(await state(pg), { banner: false, analytics: false, marketing: false, ran: 0 });
await ctx.close();

// 8 — Accept all on a first visit releases the held script at once, without a reload
[ctx, pg] = await fresh();
await pg.goto(base + '/home/', { waitUntil: 'load' });
await pg.click('.cc-banner [data-cc="accept"]');
assert.deepEqual(await state(pg), { banner: false, analytics: true, marketing: true, ran: 1 });
assert.deepEqual(await stored(ctx), { v: '1', analytics: '1', marketing: '1' });

// 9 — a choice saved under another VERSION does not count: the banner asks again
await ctx.addCookies([{ name: 'tf_consent', value: encodeURIComponent('v=0&analytics=1&marketing=1&at=1'), url: base }]);
await pg.reload({ waitUntil: 'load' });
assert.deepEqual(await state(pg), { banner: true, analytics: false, marketing: false, ran: 0 });
await ctx.close();

// 10 — a phone: the banner and the dialog both fit the screen
[ctx, pg] = await fresh({ width: 390, height: 844 });
await pg.goto(base + '/home/', { waitUntil: 'load' });
const phone = await pg.locator('.cc-banner').boundingBox();
assert.ok(phone.x >= 0 && phone.x + phone.width <= 390 && phone.y + phone.height <= 844, 'banner off a phone: ' + JSON.stringify(phone));
await pg.click('.cc-banner [data-cc="manage"]');
const dlg = await pg.locator('.cc-dialog').boundingBox();
assert.ok(dlg.y >= 0 && dlg.y + dlg.height <= 844 && dlg.x >= 0 && dlg.x + dlg.width <= 390, 'dialog off a phone: ' + JSON.stringify(dlg));
await ctx.close();

console.log('all checks pass');
await b.close();
