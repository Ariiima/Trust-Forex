// Frame-time harness for the home page's protocol corridor — the one place on the site where the
// README asks for a number before anything ships. It has already cost four ideas: a sticky rail, a
// ground drift, a glow riding a wipe, and the travelling band every other blue ground carries.
//
//   (cd design/landing && python3 -m http.server 5311) &
//   node design/landing/_qa/perf-corridor.mjs
//
// 220 notches down the four steps at 1440x900 — a hard continuous flick, not a reader's pace, which
// is the point: the corridor has to hold up at the speed someone skims it. Six arms, interleaved so
// a warming machine cannot hand one of them a better score:
//
//   still     the corridor as four still pictures scrolling plainly, nothing arriving
//   arrival   the word and its sentence, the four scrolling plainly (what shipped before the stack)
//   square    the four stacking with square corners, and the arrival
//   bare      the four stacking with rounded corners, and the arrival, no travelling band
//   noglass   the band back on, but the four on their plain blue ground
//   shipped   what ships: all of that, and the painted glass (page.css, "the four are glass"; founder, 2026-09-13)
//
// GROUND_OFF is kept and unused on purpose. Four ways of lighting the corridor were built and all
// four measured out (page.css carries the numbers and the reasoning); this arm is what to switch back
// on to re-run them, rather than deriving the finding a fifth time.
//
// Both arms run the same markup, fonts and grounds; the injected CSS is the only difference, so the
// gap between two arms is the thing itself and nothing else. Long frames are >20ms.
//
// Absolute counts mean nothing across machines: headless Chromium composites in software, so every
// arm here drops frames a real browser would not. Only the GAP between arms transfers, and a gap
// inside the run-to-run spread is not a gap. The README carries the last numbers this printed;
// replace them when the corridor changes.
import { chromium } from 'playwright';

const RUNS = 5;
const NOTCHES = 220;

const NO_ARRIVAL = `
  html.js .step-title,html.js .step.step-here .step-title{transition:none!important;filter:none!important;
    font-weight:var(--weight-display)!important;letter-spacing:-.065em!important;opacity:1!important}
  html.js .step .step-copy{transition:none!important;opacity:1!important;transform:none!important;
    -webkit-mask-image:none!important;mask-image:none!important}`;
const GROUND_OFF = `.protocol-run .step .rayfield.k i{animation:none!important}`;   // see above
// the four as plain screens again: nothing pins, no gap after each, nothing scales, dims or hides
const NO_STACK = `
  html.snap .protocol-run .hold>.screen{position:relative!important}
  .protocol-run .hold::after{display:none!important}
  .protocol-run .step,.protocol-run .step::after{animation:none!important;will-change:auto!important}`;

// the stack with square corners: the incoming step scales and the pinned one dims, nothing rounds
const NO_ROUND = `
  html.snap #step-2{animation:stack-in linear both,cover step-end both!important;animation-timeline:--s2,--s3!important;animation-range:entry,entry 99% entry 100%!important}
  html.snap #step-3{animation:stack-in linear both,cover step-end both!important;animation-timeline:--s3,--s4!important;animation-range:entry,entry 99% entry 100%!important}
  html.snap #step-4{animation:stack-in linear both!important;animation-timeline:--s4!important;animation-range:entry!important}`;

// the travelling band (page.css, "the light travels these four too"), taken off
const NO_BAND = `.protocol-run .step .rayfield.k i:nth-child(4){display:none!important}`;

// the painted glass (page.css, "the four are glass"), taken off: the sheet, the softened grid, and the
// band back to its single reflection
const NO_GLASS = `.protocol-run .step .rayfield.k i:nth-child(3){display:none!important}
  .protocol-run .step .rayfield.k::before{filter:none!important}
  .protocol-run .step .rayfield.k i:nth-child(4){background:linear-gradient(115deg,transparent 36%,rgba(255,255,255,.11) 47%,rgba(255,255,255,.03) 53%,transparent 64%)!important}`;

const ARMS = {
  still: NO_ARRIVAL + NO_STACK + NO_BAND + NO_GLASS,
  arrival: NO_STACK + NO_BAND + NO_GLASS,
  square: NO_ROUND + NO_BAND + NO_GLASS,
  bare: NO_BAND + NO_GLASS,
  noglass: NO_GLASS,
  shipped: '',
};

const b = await chromium.launch();

const run = async (css) => {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:5311/home/', { waitUntil: 'networkidle' });
  if (css) await p.addStyleTag({ content: css });
  // park one viewport above the run, so the whole corridor is still ahead of the scroll
  await p.evaluate(() => scrollTo(0, document.getElementById('step-1').getBoundingClientRect().top + scrollY - innerHeight));
  await p.waitForTimeout(600);
  await p.mouse.move(720, 500);
  await p.evaluate(() => {
    window.__f = []; let last = performance.now();
    const loop = (t) => { window.__f.push(t - last); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await p.evaluate(() => { window.__f.length = 0; });
  for (let k = 0; k < NOTCHES; k++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(12); }
  await p.waitForTimeout(1200);
  const f = await p.evaluate(() => window.__f.slice());
  await p.close();
  return { long: f.filter((x) => x > 20).length, max: Math.max(...f), frames: f.length };
};

const res = Object.fromEntries(Object.keys(ARMS).map((k) => [k, []]));
for (let i = 0; i < RUNS; i++) {
  for (const [name, css] of Object.entries(ARMS)) res[name].push(await run(css));
  process.stdout.write(`run ${i + 1}/${RUNS}\r`);
}
await b.close();

console.log(`\n${NOTCHES} notches down the four protocol steps, ${RUNS} runs each, 1440x900`);
console.log('long frames are >20ms; only the gap between arms transfers off this machine\n');
const stat = (rows) => {
  const l = rows.map((r) => r.long).sort((a, c) => a - c);
  return { mid: l[(l.length - 1) >> 1], lo: l[0], hi: l[l.length - 1], max: Math.max(...rows.map((r) => r.max)) };
};
const s = Object.fromEntries(Object.entries(res).map(([k, v]) => [k, stat(v)]));
for (const [k, v] of Object.entries(s)) {
  console.log(`${k.padEnd(8)} ${String(v.mid).padStart(4)} median   spread ${v.lo}–${v.hi}   worst frame ${v.max.toFixed(0)}ms`);
}
const gap = (a, c) => {
  const overlap = s[a].lo <= s[c].hi && s[c].lo <= s[a].hi;
  const d = s[a].mid - s[c].mid;
  return `${(d >= 0 ? '+' : '') + d} (${overlap ? 'inside the spread' : 'OUTSIDE the spread'})`;
};
console.log(`\nthe word and its sentence  ${gap('arrival', 'still')}`);
console.log(`the stack, square corners ${gap('square', 'arrival')}`);
console.log(`the stack, rounded        ${gap('bare', 'arrival')}`);
console.log(`the corners alone         ${gap('bare', 'square')}`);
console.log(`the travelling band       ${gap('noglass', 'bare')}`);
console.log(`the painted glass         ${gap('shipped', 'noglass')}`);