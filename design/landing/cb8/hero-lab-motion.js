/* Hero ground lab — motion. Lab only; nothing here ships.
   Each candidate mounts into the live ground markup and returns { start, stop, freeze }.
   freeze() is the important one: it must land on the SAME frame every time, because
   design/review/shoot.mjs captures with reducedMotion:'reduce' and any drift there turns
   into a false diff on every screen. Simulations therefore re-seed and replay a fixed number
   of steps rather than stopping wherever they happened to be. */
(() => {
'use strict';

const REDUCE = () => document.documentElement.classList.contains('reduce');

/* one seeded PRNG, so "random" is the same random on every run */
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

function canvasIn(root){
  const c = document.createElement('canvas');
  root.appendChild(c);
  const fit = () => {
    const r = root.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    c.width = Math.max(1, Math.round(r.width * d));
    c.height = Math.max(1, Math.round(r.height * d));
  };
  fit(); new ResizeObserver(fit).observe(root);
  return c;
}

/* the loop every canvas candidate runs on: fixed 16.7 ms steps, so a freeze of N steps is
   the same picture whatever the machine's frame rate */
function engine({ step, paint, reset, freezeSteps = 150 }){
  let raf = 0, last = 0, alive = false;
  const tick = now => {
    const dt = Math.min(50, now - last) || 16.7; last = now;
    step(dt / 16.7); paint();
    if (alive) raf = requestAnimationFrame(tick);
  };
  return {
    start(){ if (alive || REDUCE()) return; alive = true; last = performance.now(); raf = requestAnimationFrame(tick); },
    stop(){ alive = false; cancelAnimationFrame(raf); },
    freeze(){ this.stop(); reset(); for (let i = 0; i < freezeSteps; i++) step(1); paint(); },
    repaint(){ paint(); },
  };
}

/* ---------------------------------------------------------------- A · CSS only */
/* d06 · pointer parallax — the only CSS candidate that needs a listener */
function parallax(root){
  const card = root.closest('.card');
  const on = e => {
    const r = card.getBoundingClientRect();
    root.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3));
    root.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3));
  };
  const off = () => { root.style.setProperty('--mx', 0); root.style.setProperty('--my', 0); };
  return {
    start(){ if (REDUCE()) return; card.addEventListener('pointermove', on); card.addEventListener('pointerleave', off); },
    stop(){ card.removeEventListener('pointermove', on); card.removeEventListener('pointerleave', off); },
    freeze(){ this.stop(); off(); },
  };
}

/* ---------------------------------------------------------------- B · canvas */

/* d08 · Network — nodes drift, a link draws when two are close enough. The pointer pulls the
   nearest ones a little, which is the whole interaction. */
function network(root){
  const c = canvasIn(root), g = c.getContext('2d');
  let pts = [], px = -9e9, py = -9e9;
  const rnd = mulberry32(7);
  const reset = () => {
    const n = Math.max(18, Math.min(54, Math.round(c.width * c.height / 26000)));
    pts = Array.from({ length: n }, () => ({
      x: rnd() * c.width, y: rnd() * c.height * .82,
      vx: (rnd() - .5) * 1.1, vy: (rnd() - .5) * 1.1, r: rnd() * 1.8 + 1.2 }));
  };
  const step = k => {
    for (const p of pts){
      p.x += p.vx * k; p.y += p.vy * k;
      if (p.x < 0 || p.x > c.width) p.vx *= -1;
      if (p.y < 0 || p.y > c.height * .86) p.vy *= -1;
      const dx = px - p.x, dy = py - p.y, d2 = dx * dx + dy * dy;
      if (d2 < 40000 && d2 > 1){ const f = .4 / Math.sqrt(d2); p.x += dx * f * k; p.y += dy * f * k; }
    }
  };
  const paint = () => {
    const R = Math.min(190, c.width * .13);
    g.clearRect(0, 0, c.width, c.height);
    g.lineWidth = Math.max(1, c.width / 1400);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++){
      const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > R) continue;
      g.strokeStyle = `rgba(208,219,245,${(1 - d / R) * .34})`;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    for (const p of pts){
      g.fillStyle = `rgba(255,255,255,${.35 + p.r * .16})`;
      g.beginPath(); g.arc(p.x, p.y, p.r * (c.width / 1400), 0, 6.2832); g.fill();
    }
  };
  const eng = engine({ step, paint, reset });
  const track = e => { const r = c.getBoundingClientRect(), d = c.width / r.width;
    px = (e.clientX - r.left) * d; py = (e.clientY - r.top) * d; };
  const clear = () => { px = py = -9e9; };
  reset();
  return {
    start(){ root.closest('.card').addEventListener('pointermove', track);
             root.closest('.card').addEventListener('pointerleave', clear); eng.start(); },
    stop(){ root.closest('.card').removeEventListener('pointermove', track); eng.stop(); },
    freeze(){ clear(); eng.freeze(); },
  };
}

/* d09 · Tape — the record being written: a price line scrolling in from the right, with the
   last point lit. Same idea as the still Trace, except it is arriving. */
function tape(root){
  const c = canvasIn(root), g = c.getContext('2d');
  let ys = [], rnd = mulberry32(21), drift = 0, acc = 0;
  const N = 150;
  const reset = () => { rnd = mulberry32(21); ys = []; let v = .5;
    for (let i = 0; i < N; i++){ v += (rnd() - .48) * .035; v = Math.max(.12, Math.min(.88, v)); ys.push(v); } };
  const step = k => {
    acc += k;
    if (acc >= 6){ acc = 0; let v = ys[ys.length - 1] + (rnd() - .47) * .05;
      ys.push(Math.max(.1, Math.min(.9, v))); ys.shift(); }
    drift = acc / 6;
  };
  const paint = () => {
    const w = c.width, h = c.height, top = h * .52, band = h * .42;
    const dx = w / (N - 2), X = i => (i - drift) * dx, Y = v => top + (1 - v) * band;
    g.clearRect(0, 0, w, h);
    g.beginPath(); g.moveTo(X(0), h);
    for (let i = 0; i < N; i++) g.lineTo(X(i), Y(ys[i]));
    g.lineTo(X(N - 1), h); g.closePath();
    const fill = g.createLinearGradient(0, top, 0, h);
    fill.addColorStop(0, 'rgba(208,219,245,.16)'); fill.addColorStop(1, 'rgba(208,219,245,0)');
    g.fillStyle = fill; g.fill();
    g.beginPath();
    for (let i = 0; i < N; i++) i ? g.lineTo(X(i), Y(ys[i])) : g.moveTo(X(i), Y(ys[i]));
    g.lineWidth = Math.max(1.4, w / 720); g.strokeStyle = 'rgba(255,255,255,.62)';
    g.lineJoin = g.lineCap = 'round'; g.stroke();
    const lx = X(N - 1), ly = Y(ys[N - 1]);
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath(); g.arc(lx, ly, Math.max(2.5, w / 420), 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, ly); g.lineTo(w, ly); g.stroke();
  };
  reset();
  return engine({ step, paint, reset, freezeSteps: 90 });
}

/* d10 · Candles — the same arrival, as OHLC bars. Closer to what the product shows, and
   noisier behind copy, which is exactly what has to be judged. */
function candles(root){
  const c = canvasIn(root), g = c.getContext('2d');
  let bars = [], rnd = mulberry32(4), acc = 0, last = .5;
  const N = 34;
  const bar = () => { const o = last, cl = Math.max(.08, Math.min(.92, o + (rnd() - .47) * .30));
    const hi = Math.max(o, cl) + rnd() * .10, lo = Math.min(o, cl) - rnd() * .10;
    last = cl; return { o, c: cl, h: hi, l: lo, up: cl >= o }; };
  const reset = () => { rnd = mulberry32(4); last = .5; bars = Array.from({ length: N }, bar); acc = 0; };
  const step = k => { acc += k; if (acc >= 40){ acc = 0; bars.push(bar()); bars.shift(); } };
  const paint = () => {
    const w = c.width, h = c.height, top = h * .5, band = h * .44, dx = w / (N - 2);
    const Y = v => top + (1 - v) * band, off = (acc / 40) * dx;
    g.clearRect(0, 0, w, h);
    bars.forEach((b, i) => {
      const x = i * dx - off + dx * .5, bw = dx * .42;
      const col = b.up ? '255,255,255' : '161,183,235', a = b.up ? .42 : .30;
      g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = Math.max(1, w / 1300);
      g.beginPath(); g.moveTo(x, Y(b.h)); g.lineTo(x, Y(b.l)); g.stroke();
      g.fillStyle = `rgba(${col},${a})`;
      const y0 = Y(Math.max(b.o, b.c)), y1 = Y(Math.min(b.o, b.c));
      g.fillRect(x - bw / 2, y0, bw, Math.max(2, y1 - y0));
    });
  };
  reset();
  return engine({ step, paint, reset, freezeSteps: 120 });
}

/* d11 · Dust — motes rising through the light. The quietest thing that still reads as alive. */
function dust(root){
  const c = canvasIn(root), g = c.getContext('2d');
  let ps = [], rnd = mulberry32(13);
  const reset = () => { rnd = mulberry32(13);
    const n = Math.max(30, Math.min(120, Math.round(c.width * c.height / 12000)));
    ps = Array.from({ length: n }, () => ({ x: rnd() * c.width, y: rnd() * c.height,
      r: rnd() * 1.6 + .5, v: rnd() * .35 + .12, w: rnd() * 6.28, s: rnd() * .012 + .004 })); };
  const step = k => { for (const p of ps){ p.y -= p.v * k; p.w += p.s * k;
    if (p.y < -6){ p.y = c.height + 6; p.x = rnd() * c.width; } } };
  const paint = () => {
    g.clearRect(0, 0, c.width, c.height);
    const u = c.width / 1400;
    for (const p of ps){
      g.fillStyle = `rgba(255,255,255,${(.16 + Math.sin(p.w) * .12).toFixed(3)})`;
      g.beginPath(); g.arc(p.x + Math.sin(p.w) * 8 * u, p.y, p.r * u, 0, 6.2832); g.fill();
    }
  };
  reset();
  return engine({ step, paint, reset, freezeSteps: 200 });
}

/* ---------------------------------------------------------------- C · WebGL */

/* d12 · Mesh — the Stripe-style flowing gradient, written here rather than vendored: four
   masses of the brand ramp pushed around by time, plus a one-bit dither because a gradient
   this wide bands badly on 8-bit displays. No licence attached to it, no three.js under it. */
const MESH_FS = `precision highp float;
uniform vec2 u_res; uniform float u_t;
float blob(vec2 p, vec2 c, float r){ return smoothstep(r, 0.0, length(p - c)); }
void main(){
  vec2 uv = gl_FragCoord.xy / u_res; uv.x *= u_res.x / u_res.y;
  float ar = u_res.x / u_res.y, t = u_t * 0.055;
  vec3 col = vec3(0.047, 0.180, 0.482);
  col = mix(col, vec3(0.263, 0.439, 0.843), blob(uv, vec2(ar * (0.78 + 0.16 * cos(t * 0.8)), 0.74 + 0.12 * sin(t * 1.3)), 0.66) * 0.85);
  col = mix(col, vec3(0.000, 0.176, 0.580), blob(uv, vec2(ar * (0.50 + 0.30 * sin(t * 0.7)), 0.10 + 0.12 * cos(t * 1.1)), 0.72) * 0.90);
  col = mix(col, vec3(1.0), blob(uv, vec2(ar * (0.22 + 0.18 * sin(t * 1.1)), 0.90 + 0.08 * cos(t * 0.9)), 0.52) * 0.72);
  float v = smoothstep(1.15, 0.30, length(uv - vec2(ar * 0.5, 0.5)));
  col *= mix(0.70, 1.0, v);
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
function mesh(root){
  const c = canvasIn(root);
  const gl = c.getContext('webgl', { antialias: false, alpha: false });
  if (!gl){ c.remove(); note(root, 'no WebGL — the CSS ground is what remains'); return null; }
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, MESH_FS));
  gl.linkProgram(p); gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(p, 'u_res'), uT = gl.getUniformLocation(p, 'u_t');
  let t = 0;
  const paint = () => { gl.viewport(0, 0, c.width, c.height); gl.uniform2f(uRes, c.width, c.height);
    gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  return engine({ step: k => { t += k / 60; }, paint, reset: () => { t = 0; }, freezeSteps: 600 });
}

/* d13 · Whatamesh — the ready-made version of d12, pulled from unpkg AT RUNTIME and only in
   this lab. It is Stripe's gradient reimplemented by kevinhufnagl, and the package carries no
   licence file and no licence field, so it is not vendored into the repo on my say-so.
   Judge the look here; the licence question is separate and comes first. */
function whatamesh(root){
  const c = canvasIn(root);
  c.id = 'wm-' + Math.random().toString(36).slice(2, 8);
  let inst = null;
  const load = () => import('https://unpkg.com/whatamesh@0.2.0/lib/Gradient.js')
    .then(m => { inst = new (m.Gradient || m.default)(); inst.initGradient('#' + c.id); })
    .catch(() => note(root, 'unpkg unreachable — this is why the site vendors its libraries'));
  return {
    start(){ if (!inst) load(); else try { inst.play(); } catch {} },
    stop(){ try { inst && inst.pause(); } catch {} },
    freeze(){ this.stop(); },
  };
}

/* ---------------------------------------------------------------- D · authored media */

/* d14 · Lottie — lab-halos.json on the player already shipped for the icons. Four hard
   ellipses on keyframes; the softness is one CSS blur over the finished SVG. */
function lottieHalos(root){
  const box = document.createElement('div'); box.className = 'lottie'; root.appendChild(box);
  if (typeof lottie === 'undefined'){ note(root, 'lottie player missing'); return null; }
  const anim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: true, autoplay: false, path: 'lab-halos.json' });
  return {
    start(){ if (!REDUCE()) anim.play(); },
    stop(){ anim.pause(); },
    freeze(){ anim.goToAndStop(90, true); },
  };
}

/* d15 · Film — shared/lane/obj-crack.mp4. It is already in the repo, referenced by nothing:
   a shell breaking to show a navy sphere, 121 frames long. Luminosity keeps it in the blue. */
function film(root){
  const v = document.createElement('video');
  Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'metadata',
    poster: '../shared/lane/obj-crack-poster.jpg', src: '../shared/lane/obj-crack.mp4' });
  v.setAttribute('playsinline', ''); root.appendChild(v);
  return {
    start(){ if (!REDUCE()) v.play().catch(() => note(root, 'autoplay refused — poster only')); },
    stop(){ v.pause(); },
    freeze(){ v.pause(); try { v.currentTime = 2; } catch {} },
  };
}

/* d16 · Frames — the same shot as 121 stills, drawn at the reader's scroll position instead of
   at a time. Nothing plays: turn the page and the shell opens. The cost is 121 requests and
   about 1.8 MB, so in production it wants decoding ahead and a much shorter sequence. */
function frames(root){
  const c = canvasIn(root), g = c.getContext('2d');
  const N = 121, imgs = new Array(N); let loaded = 0, want = 0, raf = 0, alive = false;
  const src = i => `../shared/lane/obj-crack/f_${String(i + 1).padStart(3, '0')}.webp`;
  const grab = i => { if (imgs[i]) return; const im = new Image(); im.src = src(i);
    im.onload = () => { loaded++; draw(); }; imgs[i] = im; };
  const nearest = i => { for (let d = 0; d < N; d++){
      if (imgs[i + d] && imgs[i + d].complete) return imgs[i + d];
      if (imgs[i - d] && imgs[i - d].complete) return imgs[i - d]; } return null; };
  const draw = () => {
    const im = nearest(want); if (!im) return;
    const s = Math.max(c.width / im.width, c.height / im.height);
    const w = im.width * s, h = im.height * s;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h);
  };
  const progress = () => { const r = root.getBoundingClientRect();
    return Math.max(0, Math.min(1, 1 - (r.bottom - innerHeight * .1) / (r.height + innerHeight * .8))); };
  const tick = () => { want = Math.round(progress() * (N - 1)); grab(want);
    for (let k = 1; k <= 4; k++){ grab(Math.min(N - 1, want + k * 6)); }
    draw(); if (alive) raf = requestAnimationFrame(tick); };
  return {
    start(){ if (alive) return; alive = true; tick(); },
    stop(){ alive = false; cancelAnimationFrame(raf); },
    freeze(){ this.stop(); want = 60; grab(60); draw(); },
  };
}

/* d17 · Photograph — shared/lane/ground-sky.png in soft-light under the field, on a slow
   push-in. 507 KB as a PNG, which is the wrong format for a photograph; as WebP it is a
   fraction of that. Included to test whether a real image belongs here at all. */
function photo(root){
  const im = document.createElement('img');
  im.className = 'media'; im.alt = ''; im.src = '../shared/lane/ground-sky.png';
  root.appendChild(im);
  return { start(){}, stop(){}, freeze(){} };
}

function note(root, text){
  const n = document.createElement('div'); n.className = 'note-fallback'; n.textContent = text;
  root.appendChild(n);
}

/* ---------------------------------------------------------------- the sheet */

const GROUNDS = [
  { id:'d01', name:'Liquid',     note:'the page\'s own #liquid filter, animated', kb:'0 KB',
    html:'<div class="warp"><b></b><b></b><b></b></div>' },
  { id:'d02', name:'Aurora',     note:'one ribbon drifting along the top', kb:'0 KB' },
  { id:'d03', name:'Radar',      note:'a conic pass over range rings', kb:'0 KB' },
  { id:'d04', name:'Pulse',      note:'a ring leaves the source every 3 s', kb:'0 KB' },
  { id:'d05', name:'Shimmer',    note:'one specular band every 9 s', kb:'0 KB' },
  { id:'d06', name:'Parallax',   note:'lights follow the pointer; nothing on touch', kb:'~0.3 KB', mount:parallax },
  { id:'d07', name:'Scroll',     note:'view-timeline only — moves as the hero leaves', kb:'0 KB' },
  { id:'d08', name:'Network',    note:'nodes, links, pointer pull — Referral', kb:'~1.3 KB', mount:network },
  { id:'d09', name:'Tape',       note:'the record arriving, live — Home / Results', kb:'~1.1 KB', mount:tape },
  { id:'d10', name:'Candles',    note:'OHLC bars scrolling in', kb:'~1.2 KB', mount:candles },
  { id:'d11', name:'Dust',       note:'motes rising through the light', kb:'~0.8 KB', mount:dust },
  { id:'d12', name:'Mesh',       note:'flowing gradient, own shader, no library', kb:'~2 KB', mount:mesh },
  { id:'d13', name:'Whatamesh',  note:'the ready-made Stripe gradient, from unpkg', kb:'40 KB', warn:'no licence', mount:whatamesh },
  { id:'d14', name:'Lottie',     note:'authored loop on the shipped player', kb:'2.9 KB + player', mount:lottieHalos },
  { id:'d15', name:'Film',       note:'obj-crack.mp4, already in the repo', kb:'2.3 MB', warn:'LCP', mount:film },
  { id:'d16', name:'Frames',     note:'121 stills scrubbed by scroll', kb:'1.8 MB', warn:'121 requests', mount:frames },
  { id:'d17', name:'Photograph', note:'a real sky under the blue, slow push-in', kb:'507 KB', warn:'PNG', mount:photo },
];

const COPY = {
  home:        ['XAUUSD signals with a record you can check.','Each signal is published with one entry, a stop loss and defined take profit levels. Every signal stays in the record, with outcomes measured target by target.','View Results'],
  results:     ['Every signal, every target, kept.','TP1 to TP4 are measured separately, each with its own win rate. No signal is removed from the record.','Open the record'],
  brokers:     ['GTCFX','Forex and multi-asset CFDs, with cashback on every eligible lot you close.','Open an account'],
  referral:    ['The things worth using are worth sharing','If TrustForex works for you, share it with another trader and let them form their own view.','Get your links'],
  partnership: ['Create more value for the clients you already have','Give selected clients a reason to return, fund and stay active through a TrustForex experience sponsored by your broker.','Submit a Partnership Request'],
  about:       ['The Story Behind TrustForex','From Unverifiable Claims to a Standard Users Can Evaluate','Read the story'],
};

const grid = document.getElementById('grid');
grid.innerHTML = GROUNDS.map(g => `
  <section class="card screen-dark on-dark" data-id="${g.id}">
    <div class="rayfield k ${g.id}" aria-hidden="true">${g.html || ''}<i></i><i></i><i></i><i></i></div>
    <div class="tag"><b>${g.id.slice(1)} · ${g.name}</b><span>${g.note}</span>${g.warn ? `<em>${g.warn}</em>` : ''}<span class="kb">${g.kb}</span></div>
    <div class="card-body"><h2 class="display"></h2><p></p><a class="btn btn-solid" href="#"></a></div>
  </section>`).join('');

/* mount, then run only what is on screen: seventeen live grounds on one page is not a test
   of any one of them */
const live = new Map();
for (const g of GROUNDS){
  if (!g.mount) continue;
  const root = grid.querySelector(`.card[data-id="${g.id}"] .rayfield`);
  const inst = g.mount(root);
  if (inst) live.set(g.id, inst);
}
const io = new IntersectionObserver(es => { for (const e of es){
  const inst = live.get(e.target.dataset.id); if (!inst) continue;
  if (e.isIntersecting){ REDUCE() ? inst.freeze() : inst.start(); } else inst.stop();
} }, { rootMargin: '200px' });
grid.querySelectorAll('.card').forEach(c => io.observe(c));

function setCopy(key){
  const [h, p, cta] = COPY[key];
  grid.querySelectorAll('.card-body').forEach(b => {
    b.querySelector('h2').textContent = h;
    b.querySelector('p').textContent = p;
    b.querySelector('.btn').textContent = cta;
  });
}
setCopy('home');
document.getElementById('copy').addEventListener('change', e => setCopy(e.target.value));

for (const [id, cls] of [['t-full','full'], ['t-band','band'], ['t-mirror','mirror']]){
  const b = document.getElementById(id);
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle(cls, on);
  });
}

/* Reduce is the one toggle that matters: it is what the design-review sweep sees. */
const rb = document.getElementById('t-reduce');
const applyReduce = on => {
  document.documentElement.classList.toggle('reduce', on);
  const svg = document.getElementById('liquid-svg');
  on ? svg.pauseAnimations() : svg.unpauseAnimations();
  for (const inst of live.values()) on ? inst.freeze() : inst.start();
};
rb.addEventListener('click', () => {
  const on = rb.getAttribute('aria-pressed') !== 'true';
  rb.setAttribute('aria-pressed', String(on));
  applyReduce(on);
});
if (new URLSearchParams(location.search).get('reduce') === '1' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches){
  rb.setAttribute('aria-pressed', 'true'); applyReduce(true);
}
})();
