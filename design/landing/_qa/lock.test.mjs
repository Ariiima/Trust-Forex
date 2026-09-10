// Does the hard lock actually lock? A burst of wheel events (what one trackpad flick emits)
// must advance exactly one screen; soft mode must not be capped that way.
import { chromium } from 'playwright';
// a smooth scroll across 11 screens takes well over a second — wait for the index to settle
// rather than guessing a timeout, or the test reports the page one screen short of the truth.
const settle = async (p, at) => {
  let last = -1, same = 0;
  for (let i = 0; i < 60 && same < 4; i++) {
    await p.waitForTimeout(100);
    const now = await at(p);
    same = now === last ? same + 1 : 0;
    last = now;
  }
  return last;
};
const b = await chromium.launch();
// read the page's own section index (what drives the rail), not a guess from rects
const at = p => p.evaluate(() => [...document.querySelectorAll('.dot')]
  .findIndex(d => d.getAttribute('aria-current') === 'true'));
const fails = [];

for (const [mode, expect] of [['hard', 1], ['soft', null]]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`http://localhost:5311/cb8/?lock=${mode}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.mouse.move(720, 500);   // wheel fires at the cursor; (0,0) is the fixed nav, not the deck
  const start = await at(p);
  // one flick — 20 ticks, so in soft mode it lands well past the first snap point rather than between two
  for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(12); }
  const moved = await settle(p, at) - start;
  if (mode === 'hard' && moved !== expect) fails.push(`hard: one flick moved ${moved} screens, expected ${expect}`);
  if (mode === 'soft' && moved < 2) fails.push(`soft: one flick moved ${moved} screens, expected free scrolling (2+)`);
  console.log(`${mode}: one 20-tick flick moved ${moved} screen(s)`);

  if (mode === 'hard') {
    // a realistic macOS momentum tail — 14 decaying ticks over ~1.3s, outlasting the transition —
    // is still ONE gesture: exactly one screen
    const s2 = await at(p);
    for (let d = 130; d >= 8; d -= 9) { await p.mouse.wheel(0, d); await p.waitForTimeout(90); }
    const m2 = await settle(p, at) - s2;
    if (m2 !== 1) fails.push(`hard: a momentum tail moved ${m2} screens, expected 1`);
    console.log(`hard: a 1.3s momentum tail moved ${m2} screen(s)`);
    // the same tail with one dropped frame: two ticks merge into one bigger one. That bigger tick
    // is NOT a new gesture (2026-09-07: "sometimes it goes two screens") — still exactly one screen
    const s2b = await at(p);
    for (let d = 130, i = 0; d >= 8; d -= 9, i++) { const merged = i === 4; await p.mouse.wheel(0, merged ? d * 2 + 3 : d); await p.waitForTimeout(merged ? 120 : 60); }
    const m2b = await settle(p, at) - s2b;
    if (m2b !== 1) fails.push(`hard: a momentum tail with a merged tick moved ${m2b} screens, expected 1`);
    console.log(`hard: a momentum tail with one merged tick moved ${m2b} screen(s)`);
    // scrolling that never stops must never freeze the page (reported 2026-09-05: "stuck in the
    // middle, I have to wait and try again") — a steady two-finger drag, jittering deltas, 2.4s
    const s3 = await at(p), t0 = Date.now(); let k = 0;
    while (Date.now() - t0 < 2400) { await p.mouse.wheel(0, 34 + (k++ % 3) * 3); await p.waitForTimeout(30); }
    const m3 = await settle(p, at) - s3;
    if (m3 < 2) fails.push(`hard: 2.4s of continuous scrolling moved ${m3} screen(s) — the page froze`);
    console.log(`hard: 2.4s of continuous trackpad scrolling moved ${m3} screen(s)`);
    // a notched mouse wheel spun steadily — equal ticks, 60ms apart, 1.8s — must keep moving too
    const s4 = await at(p);
    for (let i = 0; i < 30; i++) { await p.mouse.wheel(0, 100); await p.waitForTimeout(60); }
    const m4 = await settle(p, at) - s4;
    if (m4 < 2) fails.push(`hard: 1.8s of mouse-wheel spinning moved ${m4} screen(s) — the page froze`);
    console.log(`hard: 1.8s of mouse-wheel spinning moved ${m4} screen(s)`);
  }

  // soft mode locks inside the card stack; the merged-tick tail must move exactly one card there too
  if (mode === 'soft') {
    await p.evaluate(() => window.__go(3));   // 01 Broker, the first stacked card
    await settle(p, at);
    const s5 = await at(p);
    for (let d = 130, i = 0; d >= 8; d -= 9, i++) { const merged = i === 4; await p.mouse.wheel(0, merged ? d * 2 + 3 : d); await p.waitForTimeout(merged ? 120 : 60); }
    const m5 = await settle(p, at) - s5;
    if (m5 !== 1) fails.push(`soft: a momentum tail with a merged tick moved ${m5} cards, expected 1`);
    console.log(`soft: in the stack, a momentum tail with one merged tick moved ${m5} card(s)`);
  }

  // keyboard must work in hard mode — it is the only non-mouse operation
  if (mode === 'hard') {
    const last = await p.evaluate(() => document.querySelectorAll('.screen').length - 1);
    await p.keyboard.press('End');
    const end = await settle(p, at);
    if (end !== last) fails.push(`hard: End landed on screen ${end}, expected ${last}`);
    await p.keyboard.press('Home');
    const home = await settle(p, at);
    if (home !== 0) fails.push(`hard: Home landed on screen ${home}, expected 0`);
    console.log(`hard: End -> ${end} of ${last}, Home -> ${home}`);
  }
  await p.close();
}
await b.close();
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'lock behaviour OK');
process.exit(fails.length ? 1 : 0);
