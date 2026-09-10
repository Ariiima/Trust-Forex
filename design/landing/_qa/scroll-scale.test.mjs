// Run against the local landing server. Covers the sticky-card regression, both entry
// boundaries, input reversal, and the shared responsive scale across all current variants.
//   node design/landing/_qa/scroll-scale.test.mjs [http://127.0.0.1:5311] [screenshot-directory]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:5311';
const scrollingOnly = process.argv.includes('--scroll-only');
const shots = scrollingOnly ? null : process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
const failures = [];
const check = async (name, fn) => {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (e) { failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name}: ${e.message}`); }
};
const state = p => p.evaluate(() => {
  const d = document.querySelector('#deck');
  return { y: d.scrollTop, index: [...document.querySelectorAll('.dot')].findIndex(d => d.getAttribute('aria-current') === 'true'),
    moving: document.documentElement.classList.contains('travelling') };
});
async function landed(p, i) {
  await p.waitForFunction(i => {
    const d = document.querySelector('#deck'), anchors = [...document.querySelectorAll('.scroll-anchor')];
    const target = Math.min(anchors[i].getBoundingClientRect().top + d.scrollTop, d.scrollHeight - d.clientHeight);
    return !document.documentElement.classList.contains('travelling') && Math.abs(d.scrollTop - target) < 2
      && [...document.querySelectorAll('.dot')].findIndex(d => d.getAttribute('aria-current') === 'true') === i;
  }, i, { timeout: 4000 }).catch(async e => { throw new Error(`${e.message}; expected ${i}, got ${JSON.stringify(await state(p))}`); });
}
const go = async (p, i) => { await p.evaluate(i => window.__go(i), i); await landed(p, i); };

try {
  if (!scrollingOnly) await check('single Cashback entry, runtime assets and controls', async () => {
    const pages = readdirSync(new URL('../', import.meta.url), { recursive: true })
      .filter(path => path.endsWith('.html')).sort();
    assert.deepEqual(pages, ['cb8/index.html', 'index.html']);
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    try {
      await p.goto(`${base}/?check=1`, { waitUntil: 'networkidle' });
      assert.equal(new URL(p.url()).pathname, '/cb8/');
      assert.equal(new URL(p.url()).search, '?check=1');
      await go(p, 7);
      await p.locator('#volume').fill('100');
      await p.locator('.level[data-rate="30"]').click();
      assert.match(await p.locator('#estimate').innerText(), /\$510/);
      await go(p, 10);
      const question = p.locator('.faq-q').first();
      assert.equal(await question.getAttribute('aria-expanded'), 'true');
      await question.click();
      assert.equal(await question.getAttribute('aria-expanded'), 'false');
      assert.deepEqual(errors, []);
    } finally { await p.close(); }
  });
  for (const variant of ['cb8']) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(`${base}/${variant}/`, { waitUntil: 'networkidle' });
    await p.mouse.move(700, 500);
    await check(`${variant}: every stacked card down and up, including both neighbours`, async () => {
      await go(p, 2);
      for (const i of [3, 4, 5, 6, 7, 6, 5, 4, 3, 2]) {
        const { index } = await state(p);
        await p.waitForTimeout(230);
        await p.mouse.wheel(0, Math.sign(i - index) * 40);
        await landed(p, i);
      }
    });
    await check(`${variant}: reverse a gesture while the card is moving`, async () => {
      await go(p, 4);
      await p.waitForTimeout(230);
      await p.mouse.wheel(0, 80);
      await p.waitForTimeout(140);
      await p.mouse.wheel(0, -80);
      await landed(p, 4);
    });
    await check(`${variant}: momentum remains one card in either direction`, async () => {
      for (const dir of [1, -1]) {
        await go(p, 4);
        await p.waitForTimeout(230);
        for (let d = 130; d >= 8; d -= 9) { await p.mouse.wheel(0, dir * d); await p.waitForTimeout(90); }
        await landed(p, 4 + dir);
      }
    });
    await check(`${variant}: momentum is contained when leaving either edge of the stack`, async () => {
      for (const [from, dir] of [[6, 1], [3, -1]]) {
        await go(p, from);
        await p.waitForTimeout(400);
        for (let d = 130; d >= 8; d -= 9) { await p.mouse.wheel(0, dir * d); await p.waitForTimeout(90); }
        await landed(p, from + dir);
      }
    });
    await check(`${variant}: keyboard returns to earlier sticky cards`, async () => {
      await go(p, 6);
      await p.keyboard.press('ArrowUp'); await landed(p, 5);
      await p.keyboard.press('ArrowDown'); await landed(p, 6);
      await p.keyboard.press('Home'); await landed(p, 0);
    });
    await p.close();
  }

  await check('hard: expanded FAQ stays readable in both directions', async () => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await p.goto(`${base}/cb8/?lock=hard`, { waitUntil: 'networkidle' });
      await p.evaluate(() => document.querySelectorAll('.faq-item').forEach(el => el.classList.add('open')));
      await go(p, 10);
      const start = (await state(p)).y;
      await p.mouse.move(600, 500);
      await p.mouse.wheel(0, 180);
      await p.waitForTimeout(450);
      assert.ok((await state(p)).y > start + 50, 'cannot scroll through expanded answers');
      await p.mouse.wheel(0, -80);
      await p.waitForTimeout(450);
      assert.ok((await state(p)).y > start, 'upward scroll jumped past the answers');
    } finally { await p.close(); }
  });

  for (const variant of scrollingOnly ? [] : ['cb8']) {
    for (const [tag, width, height, reducedMotion] of [
      ['desktop', 1440, 900, 'no-preference'], ['laptop', 1280, 720, 'no-preference'],
      ['mobile', 390, 844, 'no-preference'], ['narrow', 320, 740, 'no-preference'],
      ['reduce', 1440, 900, 'reduce'],
    ]) {
      const p = await browser.newPage({ viewport: { width, height }, reducedMotion });
      const errors = [];
      p.on('pageerror', e => errors.push(e.message));
      await p.goto(`${base}/${variant}/?check=1`, { waitUntil: 'networkidle' });
      await check(`${variant}/${tag}: structure, scale and overflow`, async () => {
        const report = await p.evaluate(() => {
          const all = sel => [...document.querySelectorAll(sel)];
          const type = sel => all(sel).map(el => {
            const s = getComputedStyle(el); return [s.fontSize, s.fontWeight, s.lineHeight, s.letterSpacing].join('/');
          });
          // Stop animations for geometry inspection without changing the type/layout rules.
          all('.screen').forEach(s => s.classList.add('in'));
          return {
            ids: all('.screen').map(s => s.id),
            display: type('#hero .display'), final: type('#final .display'),
            title: type('.h2:not(.chapter .h2):not(#activation .h2)'), mech: type('.mech-copy h3'),
            body: type('.copy'), lede: type('.lede'), mechCopy: type('.mech-copy p'),
            wide: all('.screen').filter(s => s.scrollWidth > s.clientWidth + 2).map(s => s.id),
            overflow: all('.screen').filter(s => s.scrollHeight > s.clientHeight + 2).map(s => s.id),
            documentWide: document.documentElement.scrollWidth > innerWidth + 2,
            snap: document.documentElement.classList.contains('snap'),
            columns: getComputedStyle(document.querySelector('.ladder')).gridTemplateColumns.split(' ').length,
          };
        });
        assert.deepEqual(report.ids, ['hero','meaning','chapter-1','m1','m2','m3','m4','calculator','chapter-2','activation','faq','final']);
        for (const role of ['display','final','title','mech','body','lede','mechCopy']) assert.equal(new Set(report[role]).size, 1, `${role} differs: ${report[role]}`);
        assert.deepEqual(report.wide, [], `sideways overflow: ${report.wide}`);
        assert.deepEqual(report.overflow, [], `clipped content: ${report.overflow}`);
        assert.equal(report.documentWide, false);
        assert.equal(report.columns, 2);
        if (width < 1024 || reducedMotion === 'reduce') assert.equal(report.snap, false);
        assert.deepEqual(errors, []);
        console.log(`  display ${report.display[0]}, title ${report.title[0]}, body ${report.body[0]}`);
      });
      if (shots && variant === 'cb8' && ['desktop','mobile'].includes(tag)) {
        for (const id of ['hero','meaning','m1','m2','m3','calculator','activation','faq','final']) {
          await p.evaluate(id => window.__go([...document.querySelectorAll('.screen')].findIndex(s => s.id === id)), id);
          await p.waitForTimeout(1400);
          await p.screenshot({ path: `${shots}/${tag}-${id}.png` });
        }
      }
      await p.close();
    }
  }
} finally { await browser.close(); }
assert.deepEqual(failures, [], failures.join('\n'));
