// Home: the header leaves while the plans are on view, and only then (home/page.css, "The header
// gives the plans its room"). Hold mode pushes the strip off with the plans screen's top edge, pins
// the screen for its 30vh hold and brings the strip back over the screen's exit; phones and reduced
// motion keep the strip throughout.
//   node design/landing/_qa/nav-plans.test.mjs [http://127.0.0.1:5311]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:5311';
const browser = await chromium.launch();
const failures = [];
const check = async (name, fn) => {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (e) { failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name}: ${e.message}`); }
};
const near = (got, want, what) => assert.ok(Math.abs(got - want) <= 2, `${what}: ${got}, expected ${want}`);

// scroll so the top of the plans' hold box — where the screen sits in the flow, even while it is
// pinned — is at viewport y = t, then read the strip, the screen, the box and the block
const at = async (p, t) => {
  await p.evaluate(t => {
    const box = document.getElementById('plans').closest('.hold') || document.getElementById('plans');
    scrollTo({ top: box.getBoundingClientRect().top + scrollY - t, behavior: 'instant' });
  }, t);
  await p.waitForTimeout(120);
  return p.evaluate(() => {
    const plans = document.getElementById('plans').getBoundingClientRect();
    const box = (document.getElementById('plans').closest('.hold') || document.getElementById('plans')).getBoundingClientRect();
    return {
      plans: Math.round(plans.top), height: Math.round(plans.height), box: Math.round(box.height),
      nav: Math.round(document.getElementById('nav').getBoundingClientRect().top),
      block: Math.round(document.querySelector('#plans .block').getBoundingClientRect().top - plans.top),
      snap: document.documentElement.classList.contains('snap'),
    };
  });
};

try {
  for (const [w, h] of [[1440, 900], [1280, 720]]) {
    await check(`hold ${w}x${h}: the strip rides the plans screen's edges`, async () => {
      const p = await browser.newPage({ viewport: { width: w, height: h } });
      const logs = [];
      p.on('console', m => logs.push(m.text()));
      p.on('pageerror', e => logs.push(`pageerror ${e.message}`));
      try {
        await p.goto(`${base}/home/?check=1`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(600);
        const top = await at(p, h + 400);   // well above the plans
        assert.equal(top.snap, true, 'not in hold mode');
        near(top.nav, 0, 'strip before the plans');
        near((await at(p, 200)).nav, 0, 'strip with the plans 200px below the top');
        // the strip leaves over the 56px that end 8px short of the top
        near((await at(p, 64)).nav, 0, 'strip as the plans edge comes 8px past its foot');
        near((await at(p, 36)).nav, -28, 'strip halfway pushed');
        near((await at(p, 8)).nav, -56, 'strip gone 8px before the plans reach the top');
        const full = await at(p, 0);
        near(full.nav, -56, 'strip with the plans at the top');
        near(full.block, 0, 'block flush with the plans screen');
        assert.ok(full.height >= h - 2, `plans screen ${full.height}px is shorter than the viewport`);
        // the hold: the screen stays pinned with the strip away for the box's extra 30vh, then scrolls on
        const hold = full.box - full.height;
        near(hold, Math.round(h * .3), 'the plans hold');
        for (const t of [-hold / 2, -hold]) {
          const s = await at(p, t);
          near(s.plans, 0, `plans pinned ${Math.round(-t)}px into the hold`);
          near(s.nav, -56, `strip ${Math.round(-t)}px into the hold`);
        }
        const after = await at(p, -hold - 100);
        near(after.plans, -100, 'plans released after the hold');
        near(after.nav, -56, 'strip just after the release');
        near((await at(p, 28 - full.box)).nav, -28, 'strip halfway back');
        near((await at(p, -full.box)).nav, 0, 'strip as the plans leave');
        near((await at(p, -full.box - 300)).nav, 0, 'strip past the plans');
        // a keyboard reader who tabs into the hidden strip gets it back
        await at(p, 0);
        await p.focus('#nav .pill');
        await p.waitForTimeout(80);
        near(await p.evaluate(() => Math.round(document.getElementById('nav').getBoundingClientRect().top)), 0, 'strip with focus inside it');
        assert.ok(logs.some(l => l.startsWith('CHECK OK')), `no CHECK OK in: ${logs.join(' | ')}`);
        assert.ok(!logs.some(l => /CHECK FAIL|pageerror/.test(l)), logs.join(' | '));
      } finally { await p.close(); }
    });
  }

  for (const [tag, opts] of [['phone', { viewport: { width: 390, height: 844 } }],
    ['reduced motion', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }]]) {
    await check(`${tag}: the strip stays`, async () => {
      const p = await browser.newPage(opts);
      try {
        await p.goto(`${base}/home/`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(600);
        for (const t of [28, 0, -300]) {
          const s = await at(p, t);
          assert.equal(s.snap, false, 'in hold mode');
          near(s.nav, 0, `strip with the plans edge at ${t}`);
        }
      } finally { await p.close(); }
    });
  }
} finally { await browser.close(); }
assert.deepEqual(failures, [], failures.join('\n'));
