// Packs the four hero-ground labs into ONE self-contained HTML file that opens by
// double-click, with no server and no network for anything the site owns.
//   node design/landing/_qa/bundle-labs.mjs [out.html]
//
// What gets inlined: the whole CSS chain (grounds, inter with the woff2 as a data URI, scale,
// base, style), each lab's own script, the Lottie player and its JSON as animationData, and
// the media out of shared/lane — the film, its poster, the sky, and every third frame of the
// 121-frame sequence. What stays on the network: the vendor tab, which is the point of the
// vendor tab, and it says so on the card when a CDN is blocked.
//
// Each lab goes into its own <iframe srcdoc>, so four sheets that all use .card and .grid
// cannot collide, and nothing boots until its tab is opened.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LANDING = join(HERE, '..');
const CB8 = join(LANDING, 'cb8');
const LANE = join(LANDING, 'shared', 'lane');
const out = process.argv[2] || join(LANDING, '..', '..', 'hero-grounds-review.html');

const read = p => readFileSync(p, 'utf8');
const b64 = (p, mime) => `data:${mime};base64,${readFileSync(p).toString('base64')}`;

/* ---- the stylesheet chain, flattened in the order the labs load it ------- */
const css = [
  read(join(CB8, 'grounds.css')),
  read(join(LANDING, 'shared', 'fonts', 'inter.css'))
    .replace('url(Inter-VF.woff2)', `url(${b64(join(LANDING, 'shared', 'fonts', 'Inter-VF.woff2'), 'font/woff2')})`),
  read(join(LANDING, 'shared', 'scale.css')),
  read(join(CB8, 'base.css')).replace(/@import url\([^)]*\);/g, ''),
  read(join(CB8, 'style.css')).replace(/@import url\([^)]*\);/g, ''),
].join('\n');

/* ---- the media the motion lab reaches for ------------------------------- */
const FRAME_STEP = 3;                       // 121 stills is 1.8 MB; every third is enough to scrub
const frames = readdirSync(join(LANE, 'obj-crack')).filter(f => f.endsWith('.webp')).sort()
  .filter((_, i) => i % FRAME_STEP === 0)
  .map(f => b64(join(LANE, 'obj-crack', f), 'image/webp'));

function inlineLab(file){
  let html = read(join(CB8, file));

  // stylesheets -> one inline block
  html = html.replace(/<link rel="stylesheet" href="grounds\.css"[^>]*>\s*<link rel="stylesheet" href="style\.css"[^>]*>/,
    `<style>\n${css}\n</style>`);

  // the lab's own script, and the lottie player
  html = html.replace(/<script src="(hero-lab-[a-z]+\.js)[^"]*"><\/script>/g,
    (_, f) => `<script>\n${read(join(CB8, f))}\n</script>`);
  html = html.replace(/<script src="ico\/lottie_light\.min\.js"><\/script>/,
    () => `<script>\n${read(join(CB8, 'ico', 'lottie_light.min.js'))}\n</script>`);

  // lottie loads its JSON over the network; inline the document instead
  html = html.replace("path: 'lab-halos.json'",
    `animationData: ${read(join(CB8, 'lab-halos.json'))}`);

  // the film, its poster and the photograph
  html = html.replace("'../shared/lane/obj-crack-poster.jpg'", JSON.stringify(b64(join(LANE, 'obj-crack-poster.jpg'), 'image/jpeg')));
  html = html.replace("'../shared/lane/obj-crack.mp4'", JSON.stringify(b64(join(LANE, 'obj-crack.mp4'), 'video/mp4')));
  html = html.replace("im.src = '../shared/lane/ground-sky.png'", `im.src = ${JSON.stringify(b64(join(LANE, 'ground-sky.png'), 'image/png'))}`);

  // the frame sequence: same scrub, fewer stills
  html = html.replace(/const src = i => `\.\.\/shared\/lane\/obj-crack\/f_\$\{String\(i \+ 1\)\.padStart\(3, '0'\)\}\.webp`;/,
    `const FRAMES = ${JSON.stringify(frames)};\n  const src = i => FRAMES[Math.min(FRAMES.length - 1, Math.round(i / (N - 1) * (FRAMES.length - 1)))];`);

  // the sheets link to each other by filename; inside the bundle the tabs do that job, so the
  // links would be dead ends for whoever opens the file
  html = html.replace(/<a href="hero-lab[^"]*"[^>]*>[\s\S]*?<\/a>/g, '');

  return html;
}

const LABS = [
  ['still',  'The still set',  'hero-lab.html',        '15 grounds of light and structure, no motion.'],
  ['motion', 'The motion set', 'hero-lab-motion.html', '17 moving grounds, from free CSS to a 2.3 MB film.'],
  ['relief', 'The relief set', 'hero-lab-relief.html', '15 material grounds: beveled tiles, engraving, bullion.'],
  ['vendor', 'Other people’s', 'hero-lab-vendor.html', '19 third-party components running live. Needs internet.'],
];

const payloads = LABS.map(([id, , file]) => {
  const html = inlineLab(file);
  if (!existsSync(join(CB8, file))) throw new Error('missing ' + file);
  // The payload rides inside a <script type="text/html">, so its own closing tags must not end
  // it. A sentinel, not a backslash escape: the browser does not unescape textContent, so a
  // "<\/script>" would reach the iframe exactly as typed and kill every inline script in it.
  return `<script type="text/html" id="lab-${id}">${html.replace(/<\/script>/g, '[[ENDSCRIPT]]')}</script>`;
}).join('\n');

const shell = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TrustForex — hero background review</title>
<style>
  :root{color-scheme:dark}
  /* one scroller only: the page is a fixed column and the sheet scrolls inside its frame */
  html,body{height:100%}
  body{margin:0;background:#070B18;color:#fff;display:flex;flex-direction:column;overflow:hidden;
    font:400 15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  header{flex:none;padding:18px 26px 0;display:flex;flex-wrap:wrap;gap:6px 24px;align-items:baseline}
  h1{margin:0;font-size:19px;letter-spacing:-.01em}
  header p{margin:0;color:rgba(255,255,255,.6);font-size:13px;max-width:96ch}
  nav{flex:none;display:flex;gap:8px;flex-wrap:wrap;padding:14px 26px;border-bottom:1px solid rgba(255,255,255,.1)}
  nav button{padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.2);
    background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:14px;cursor:pointer;
    display:flex;gap:9px;align-items:baseline}
  nav button small{color:rgba(255,255,255,.5);font-size:12px}
  nav button[aria-selected="true"]{background:#fff;color:#070B18;border-color:#fff}
  nav button[aria-selected="true"] small{color:rgba(7,11,24,.6)}
  .stage{flex:1;min-height:0}
  iframe{display:block;width:100%;height:100%;border:0;background:#0C2E7B}
</style>
</head>
<body>

<header>
  <h1>TrustForex — hero background review</h1>
  <p>Candidate hero backgrounds, each behind the site's own headline and button. Each sheet's
     toolbar switches the copy between pages and has a full-bleed view for judging at real size.
     Everything works offline except the last tab, which loads other people's components from
     their own servers.</p>
</header>

<nav id="tabs" role="tablist">
  ${LABS.map(([id, title, , note], i) =>
    `<button role="tab" data-lab="${id}" aria-selected="${i === 0}"><b>${title}</b><small>${note}</small></button>`).join('\n  ')}
</nav>

<div class="stage" id="stage"></div>

${payloads}

<script>
(() => {
  const stage = document.getElementById('stage'), made = new Map();
  function show(id){
    for (const f of made.values()) f.style.display = 'none';
    let f = made.get(id);
    if (!f){
      f = document.createElement('iframe');
      f.srcdoc = document.getElementById('lab-' + id).textContent
                   .split('[[ENDSCRIPT]]').join('<' + '/script>');
      stage.appendChild(f); made.set(id, f);
    }
    f.style.display = 'block';
    for (const b of document.querySelectorAll('#tabs button'))
      b.setAttribute('aria-selected', String(b.dataset.lab === id));
  }
  document.getElementById('tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) show(b.dataset.lab);
  });
  show('still');
})();
</script>
</body>
</html>`;

writeFileSync(out, shell);
console.log(out, (Buffer.byteLength(shell) / 1048576).toFixed(1) + ' MB,',
  frames.length, 'frames of', frames.length * FRAME_STEP);
