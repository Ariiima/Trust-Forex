// Soft scrolling approaches the chapter naturally, then holds its arrival momentum.
// node design/landing/_qa/chapter-scroll.test.mjs [http://127.0.0.1:5311]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const base = process.argv[2] || 'http://127.0.0.1:5311';
const failures = [];
async function landed(p, i) {
  await p.waitForFunction(i => !document.documentElement.classList.contains('travelling')
    && Math.abs(document.querySelectorAll('.scroll-anchor')[i].getBoundingClientRect().top) < 2,
  i, { timeout: 4000 });
}
const go = async (p, i) => { await p.evaluate(i => window.__go(i), i); await landed(p, i); };
async function wheel(p, direction, deltas, interval = 25) {
  for (const delta of deltas) {
    await p.mouse.wheel(0, direction * delta);
    await p.waitForTimeout(interval);
  }
}
async function trace(p) {
  await p.evaluate(() => {
    cancelAnimationFrame(window.traceFrame);
    window.scrollFrames = [];
    const heading = document.querySelector('#chapter-1 .h2');
    const frame = t => {
      const y = document.querySelector('#deck').scrollTop;
      window.scrollFrames.push({ t, y, headingY: heading.getBoundingClientRect().top + y,
        moving: document.documentElement.classList.contains('travelling') });
      window.traceFrame = requestAnimationFrame(frame);
    };
    window.traceFrame = requestAnimationFrame(frame);
  });
  await p.waitForTimeout(35);
}
async function checkPath(p, direction, target, nativeApproach = false) {
  const frames = await p.evaluate(() => { cancelAnimationFrame(window.traceFrame); return window.scrollFrames; });
  let changes = 0, maxJump = 0;
  for (let i = 1; i < frames.length; i++) {
    const previous = frames[i - 1], current = frames[i], delta = current.y - previous.y;
    if (nativeApproach) assert.ok(Math.abs(current.headingY - frames[0].headingY) < 2,
      'the text shifted within the chapter during entry');
    if (!delta) continue;
    changes++;
    maxJump = Math.max(maxJump, Math.abs(delta));
    assert.ok(direction * delta >= -2, `scroll reversed unexpectedly: ${previous.y} -> ${current.y}`);
    assert.ok(nativeApproach || current.moving || Math.abs(current.y - target) < 2,
      `native jump before transition: ${delta}px`);
    // Our sampling callback can precede the animation callback by one frame. Include
    // that interval when comparing displacement, particularly after a delayed paint.
    const interval = current.t - frames[Math.max(0, i - 2)].t;
    assert.ok(nativeApproach && !current.moving || Math.abs(delta) <= 30 + interval * 6,
      `discontinuous frame: ${delta}px across ${interval}ms`);
  }
  assert.ok(changes > 4, 'transition did not animate through intermediate positions');
  return Math.round(maxJump);
}

try {
  for (const mode of ['soft', 'hard']) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await p.goto(`${base}/cb8/?lock=${mode}`, { waitUntil: 'networkidle' });
      await p.mouse.move(700, 500);
      if (mode === 'soft') {
        await go(p, 1);
        await p.waitForTimeout(400);
        await p.mouse.wheel(0, 8);
        await p.waitForTimeout(850);
        assert.ok(await p.evaluate(() => document.querySelector('#deck').scrollTop < 1000),
          'an 8px nudge advanced the entire preceding section');
        console.log('PASS soft: a small nudge does not jump to the text break');

        await go(p, 1);
        await p.waitForTimeout(400);
        await wheel(p, 1, [360, 160, 40], 350);
        const partial = await p.evaluate(() => ({ y: document.querySelector('#deck').scrollTop,
          moving: document.documentElement.classList.contains('travelling') }));
        assert.ok(partial.y > 1350 && partial.y < 1550 && !partial.moving,
          `the partially visible chapter took over scrolling: ${JSON.stringify(partial)}`);
        await p.mouse.wheel(0, 600);
        await landed(p, 2);
        console.log('PASS soft: partial entry follows wheel distance and settles at the chapter boundary');

        // Small/notched input exposed browser snap pulling back after each tick.
        // Verify actual distance and every frame, before and across the boundary.
        for (const [delta, count, interval] of [[24, 20, 60], [120, 4, 90]]) {
          await go(p, 1);
          await p.waitForTimeout(400);
          await trace(p);
          await wheel(p, 1, Array(count).fill(delta), interval);
          await p.waitForTimeout(250);
          const y = await p.evaluate(() => document.querySelector('#deck').scrollTop);
          assert.ok(Math.abs(y - 1380) < 3, `480px of input moved to ${y}, expected 1380`);
          await wheel(p, 1, Array(Math.ceil(420 / delta) + 2).fill(delta), interval);
          await landed(p, 2);
          await checkPath(p, 1, 1800, true);
          console.log(`PASS soft: ${delta}px wheel ticks enter without backward snapping or text jumps`);
        }
      }
      // The missing cases in the original test: arrive DOWN then go UP, and vice versa.
      for (const [from, direction, leave] of [[1,1,-1], [3,-1,1], [1,1,1], [3,-1,-1]]) {
        await go(p, from);
        await p.waitForTimeout(400);
        await trace(p);
        for (let i = 0; i < 22; i++) {
          await p.mouse.wheel(0, direction * (i === 0 ? 600 : 120 * (22 - i) / 22));
          await p.waitForTimeout(55);
        }
        await landed(p, 2);
        await p.waitForTimeout(500);
        await landed(p, 2);
        const jump = await checkPath(p, direction, 1800, mode === 'soft' && direction > 0);
        console.log(`PASS ${mode}: smooth arrival ${direction > 0 ? 'down' : 'up'}, held through momentum (largest frame ${jump}px)`);
        await trace(p);
        // Real trackpad input starts below the movement threshold. It must not lose
        // the start/reversal of the gesture when these first tiny ticks arrive.
        await wheel(p, leave, [1, 2, 4, 8, 14, 8, 4, 2, 1]);
        await landed(p, 2 + leave);
        await p.waitForTimeout(400); // ensure it is not pulled back after apparently landing
        await landed(p, 2 + leave);
        await checkPath(p, leave, (2 + leave) * 900);
        console.log(`PASS ${mode}: trackpad gesture starting at 1px leaves ${leave > 0 ? 'downward' : 'upward'} without a click`);
      }
      for (const [from, direction] of [[1,1], [3,-1]]) {
        await go(p, from);
        await p.waitForTimeout(400);
        await p.mouse.wheel(0, direction * 900);
        await p.waitForTimeout(140);
        await trace(p);
        await wheel(p, -direction, [1, 2, 3]);
        await landed(p, from);
        await p.waitForTimeout(400);
        await landed(p, from);
        // The trace includes the few milliseconds before the reversal; check the endpoint
        // here, while the full departure traces above guard against snap-back after landing.
        console.log(`PASS ${mode}: reverse chapter entry toward section ${from}`);
      }
      for (const leave of [-1, 1]) {
        await go(p, 2);
        await p.waitForTimeout(400);
        await wheel(p, leave, Array.from({ length: 14 }, (_, i) => 130 - i * 9), 90);
        await landed(p, 2 + leave);
        console.log(`PASS ${mode}: departure momentum stops on the ${leave > 0 ? 'next' : 'preceding'} section`);

        await go(p, 2 - leave);
        await p.waitForTimeout(400);
        await p.mouse.wheel(0, leave * 900);
        await landed(p, 2);
        await p.waitForTimeout(400);
        await wheel(p, leave, Array(12).fill(0.5));
        await landed(p, 2 + leave);
        console.log(`PASS ${mode}: accumulated half-pixel input leaves ${leave > 0 ? 'downward' : 'upward'} without a click`);

        // Continue the arrival gesture, without any gap, pointerdown, or keyboard
        // event that could reset its state. A steady wheel cannot lock indefinitely.
        await go(p, 2 - leave);
        await p.waitForTimeout(400);
        const started = Date.now();
        let left = false;
        while (Date.now() - started < 5000) {
          await p.mouse.wheel(0, leave * 40);
          await p.waitForTimeout(35);
          left = await p.evaluate(leave => Math.abs(document.querySelectorAll('.scroll-anchor')[2 + leave]
            .getBoundingClientRect().top) < 2, leave);
          if (left) break;
        }
        assert.ok(left, 'uninterrupted wheel input remained stuck on the chapter');
        await landed(p, 2 + leave);
        console.log(`PASS ${mode}: uninterrupted wheel input continues ${leave > 0 ? 'downward' : 'upward'} without a click`);

        await go(p, 2 - leave);
        await p.waitForTimeout(400);
        for (let i = 0; i < 40; i++) {
          await p.mouse.wheel(0, leave * 120);
          await p.waitForTimeout(25);
          if (await p.evaluate(() => !document.documentElement.classList.contains('travelling')
            && Math.abs(document.querySelectorAll('.scroll-anchor')[2].getBoundingClientRect().top) < 2)) break;
        }
        await landed(p, 2);
        // Start another push immediately after arrival, with no 360ms gesture gap.
        await wheel(p, leave, [1, 2, 4, 8]);
        assert.ok(await p.evaluate(() => document.documentElement.classList.contains('travelling')),
          'a renewed trackpad push was ignored until the reading delay expired');
        await landed(p, 2 + leave);
        console.log(`PASS ${mode}: a renewed trackpad push immediately leaves ${leave > 0 ? 'downward' : 'upward'}`);
      }
    } catch (e) {
      const actual = await p.evaluate(() => ({ y: document.querySelector('#deck').scrollTop,
        chapterTop: document.querySelector('#chapter-1').getBoundingClientRect().top }));
      failures.push(`${mode}: ${e.message}; ${JSON.stringify(actual)}`);
      console.error(`FAIL ${failures.at(-1)}`);
    } finally { await p.close(); }
  }
} finally { await browser.close(); }
assert.deepEqual(failures, [], failures.join('\n'));
