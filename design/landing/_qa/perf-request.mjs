/* frame-time harness for the partnership form's travel to a missed field.

   Stand at the foot of the form, where Send is, press it on an empty form, and count the frames
   between the press and the page coming to rest. The travel crosses a screen carrying fourteen
   backdrop-filtered boxes and their scroll-driven streaks, so the frame count over the travel's
   own length is the whole measure: 440ms at 60fps is 26 frames, and anything much under that is
   the stutter the founder reported on 2026-09-18.

     node design/landing/_qa/perf-request.mjs                    # the page as it stands
     node design/landing/_qa/perf-request.mjs _pbefore           # any other folder under landing/
     ARMS=1 node design/landing/_qa/perf-request.mjs             # the page plus each CSS candidate
     TRACE=1 ...                                                 # every frame as <ms>:<scrollY>

   Every arm runs in one browser session, one page each, so they are measured alike. */
import { chromium } from 'playwright';

const dirs = process.argv.slice(2);
/* The levers worth re-measuring, each against the page as it stands. Machine noise between runs is
   wider than any of them, so an arm only counts interleaved with its own control — repeat a pair
   four times before believing it. On 2026-09-18 that gave 18fps with the streaks running against
   33 paused, and no difference at all from putting any of the backdrop blurs down. */
const ARMS = process.env.ARMS === '1' ? [
  ['streaks running', 'html.gliding #final .glass .panel::after,html.gliding #final .glass .tile::after{animation-play-state:running}'],
  ['as it stands', ''],
  ['pane + tile blur off', 'html.gliding #final .glass .panel,html.gliding #final .glass .tile{backdrop-filter:none;-webkit-backdrop-filter:none}'],
  ['as it stands', ''],
  ['nav + to-top + footer blur off', 'html.gliding #nav,html.gliding .to-top,html.gliding .fsig{backdrop-filter:none;-webkit-backdrop-filter:none}'],
  ['as it stands', ''],
] : [];

const b = await chromium.launch({ headless: false });

const run = async (dir, label, css) => {
  const p = await b.newPage({ viewport: { width: 1536, height: 740 }, deviceScaleFactor: 1.25 });
  const said = [];
  p.on('console', (m) => said.push(m.text()));
  await p.goto(`http://localhost:5311/${dir}/?check=1`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  if (css) await p.addStyleTag({ content: css });
  const bad = said.filter((t) => /CHECK/.test(t) && !/OK/.test(t));
  if (bad.length) console.log(`  ! ${bad.join(' | ')}`);

  // the pointer rests on the pane, as a visitor's does the moment they press Send
  await p.evaluate(() => document.querySelector('.send').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await p.waitForTimeout(700);
  const send = await p.locator('.send').boundingBox();
  await p.mouse.move(send.x + send.width / 2, send.y + send.height / 2);
  await p.waitForTimeout(500);

  // the press is dispatched from inside the page, so nothing between it and the frames is the harness's
  const r = await p.evaluate(async () => {
    const f = [];
    let last = performance.now(), on = true;
    const t0 = performance.now();
    const loop = (t) => { if (!on) return; f.push([t - t0, t - last, scrollY]); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    document.querySelector('.send').click();
    await new Promise((done) => setTimeout(done, 2600));
    on = false;
    const box = document.getElementById('pf-name').closest('.well').getBoundingClientRect();
    return { f, ring: !!document.querySelector('.well.flagging'), flagged: document.querySelectorAll('.well.invalid').length,
      seen: box.top >= 0 && box.bottom <= innerHeight, top: Math.round(box.top), view: innerHeight };
  });

  const f = r.f;
  let s = -1, e = -1;
  for (let i = 1; i < f.length; i++) { if (f[i][2] !== f[i - 1][2]) { if (s < 0) s = i; e = i; } }
  const win = s < 0 ? [] : f.slice(s, e + 1);
  const long = win.filter((x) => x[1] > 20).length;
  const max = win.length ? Math.max(...win.map((x) => x[1])) : 0;
  const took = win.length ? win.at(-1)[0] - f[s - 1][0] : 0;
  const fps = took ? (win.length / took) * 1000 : 0;
  console.log(`${label.padEnd(24)} ${String(Math.round(Math.abs(f.at(-1)[2] - f[0][2]))).padStart(4)}px in `
    + `${took.toFixed(0).padStart(4)}ms - ${String(win.length).padStart(2)} frames (${fps.toFixed(0).padStart(2)}fps), `
    + `${String(long).padStart(2)} long, max ${max.toFixed(0).padStart(3)}ms - `
    + `first missed field ${r.seen ? 'on screen' : 'OFF SCREEN'} at ${r.top}/${r.view}, `
    + `${r.flagged} flagged, ring ${r.ring ? 'on' : 'off'}`);
  if (process.env.TRACE) console.log('  ' + f.map((x) => `${Math.round(x[0])}:${Math.round(x[2])}`).join(' '));
  await p.close();
};

for (const dir of dirs.length ? dirs : ['partnership']) {
  await run(dir, dir, '');
  for (const [label, css] of ARMS) await run(dir, `  + ${label}`, css);
}
await b.close();
