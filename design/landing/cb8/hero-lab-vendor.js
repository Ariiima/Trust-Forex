/* Hero ground lab — vendor. Nothing in here is mine.
   Every ground below is a third-party component running its OWN effect, called the way its own
   README calls it. The only local code is the mount line and the brand colours passed in, so
   what you are judging is the library, not an imitation of it.

   Loaded live from jsDelivr and cdnjs. That is a lab convenience and NOT how any of this would
   ship: the site self-hosts telegram-web-app.js, Inter and lottie_light precisely because a
   blocked CDN silently degrades a real user. Anything picked here gets vendored and pinned.

   Sizes in the tags are measured, not estimated: the actual bytes each file returns today. */
(() => {
'use strict';

/* ---- what the libraries need, loaded once ------------------------------- */
const CDN = {
  three:   'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js',
  p5:      'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js',
  vanta:   e => `https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.${e}.min.js`,
  /* each preset ships its own bundle with tsparticles inside it; the plain bundle has the
     engine but none of the presets, so `preset: 'links'` on it silently renders nothing */
  ts:      (pkg, name) => `https://cdn.jsdelivr.net/npm/@tsparticles/preset-${pkg}@3/tsparticles.preset.${name}.bundle.min.js`,
  granim:  'https://cdn.jsdelivr.net/npm/granim@2.0.0/dist/granim.min.js',
  tri:     'https://cdn.jsdelivr.net/npm/trianglify@4.1.1/dist/trianglify.bundle.js',
};
const loaded = new Map();
const script = src => loaded.get(src) || loaded.set(src, new Promise((ok, no) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no;
  document.head.appendChild(s);
})).get(src);

/* ---- the brand, handed to each library in whatever form it asks for ------ */
const BLUE = 0x0C2E7B, ROYAL = 0x144CCD, PALE = 0xA1B7EB, DEEP = 0x002D94;
const HEX = { blue: '#0C2E7B', royal: '#144CCD', pale: '#A1B7EB', deep: '#002D94' };

/* ---- VANTA.JS — tengbao/vanta, MIT, 14 effects --------------------------
   One call per effect, exactly as the docs have it: VANTA.NET({ el, ...colours }).
   Unknown options are ignored by the library, so one shared colour block covers all of them. */
const VANTA_OPTS = {
  backgroundColor: BLUE, color: PALE, color1: ROYAL, color2: DEEP, color3: PALE,
  midtoneColor: ROYAL, lowlightColor: DEEP, highlightColor: PALE, baseColor: BLUE,
  shininess: 30, waveHeight: 15, waveSpeed: .8, zoom: .9, points: 10, maxDistance: 22,
  spacing: 16, showDots: true, quantity: 4, size: 1.1, speed: 1,
  mouseControls: true, touchControls: true, gyroControls: false, minHeight: 200, minWidth: 200,
};
const vanta = (effect, runtime) => root => {
  let inst = null;
  const boot = () => script(runtime === 'p5' ? CDN.p5 : CDN.three)
    .then(() => script(CDN.vanta(effect)))
    .then(() => { inst = window.VANTA[effect.toUpperCase()]({ el: root, ...VANTA_OPTS }); })
    .catch(() => fail(root, 'CDN blocked'));
  return { start(){ if (!inst) boot(); }, stop(){ try { inst && inst.destroy(); inst = null; } catch {} } };
};

/* ---- TSPARTICLES — tsparticles/tsparticles, MIT -------------------------
   Each preset ships as its own bundle with the engine inside it, and the bundle exposes a
   loader that has to run before load(). Presets run exactly as published; only the background
   colour is ours. */
const tsparticles = (pkg, name, loader, options) => root => {
  const box = document.createElement('div');
  box.id = 'ts-' + Math.random().toString(36).slice(2, 8);
  box.style.cssText = 'position:absolute;inset:0;z-index:1';
  root.appendChild(box);
  let live = null;
  return {
    start(){ if (live) return;
      script(CDN.ts(pkg, name))
        .then(() => window[loader](window.tsParticles))   /* v3: the bundle ships the preset's
             loader, it does not self-register. Skip this and load() returns a container with
             zero particles and no error. */
        .then(() => window.tsParticles.load({ id: box.id, options }))
        .then(c => { live = c; }).catch(() => fail(root, 'CDN blocked')); },
    stop(){ try { live && live.destroy(); live = null; } catch {} },
  };
};
/* the preset's own particle block is the whole point of the preset: overriding `particles` to
   recolour it wipes number, move and links with it, and the container loads with count 0. So
   the presets run as published and only the background is ours. */
const TS_BASE = {
  fullScreen: { enable: false },
  background: { color: { value: HEX.blue } },
  fpsLimit: 60,
  detectRetina: true,
};

/* ---- GRANIM.JS — sarcadass/granim.js, MIT ------------------------------- */
const granim = root => {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1';
  root.appendChild(c);
  let inst = null;
  return {
    start(){ if (inst) return;
      script(CDN.granim).then(() => { inst = new window.Granim({
        element: c, direction: 'diagonal', isPausedWhenNotInView: true,
        states: { 'default-state': { gradients: [
          [HEX.blue, HEX.royal], [HEX.royal, HEX.deep], [HEX.deep, HEX.blue]],
          transitionSpeed: 4000 } } }); }).catch(() => fail(root, 'CDN blocked')); },
    stop(){ try { inst && inst.destroy(); inst = null; } catch {} },
  };
};

/* ---- TRIANGLIFY — qrohlf/trianglify, GPL-3.0 ----------------------------
   Note the licence before anyone falls in love with it: GPL-3, not MIT. */
const trianglify = root => {
  let node = null;
  return {
    start(){ if (node) return;
      script(CDN.tri).then(() => {
        const r = root.getBoundingClientRect();
        const p = window.trianglify({ width: Math.max(400, r.width), height: Math.max(300, r.height),
          cellSize: 90, variance: .85, xColors: [HEX.deep, HEX.blue, HEX.royal, HEX.pale] });
        node = p.toSVG(); node.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1';
        root.appendChild(node);
      }).catch(() => fail(root, 'CDN blocked')); },
    stop(){ node && node.remove(); node = null; },
  };
};

/* ---- WHATAMESH — jordienr/whatamesh, NO LICENCE FILE --------------------
   Stripe's gradient, reimplemented. Kept in the set because it is the one everybody reaches
   for, flagged because the package carries no licence at all. */
const whatamesh = root => {
  const c = document.createElement('canvas');
  c.id = 'wm-' + Math.random().toString(36).slice(2, 8);
  c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;' +
    `--gradient-color-1:${HEX.blue};--gradient-color-2:${HEX.royal};` +
    `--gradient-color-3:${HEX.deep};--gradient-color-4:${HEX.pale}`;
  root.appendChild(c);
  let inst = null;
  return {
    start(){ if (inst) return;
      import('https://unpkg.com/whatamesh@0.2.0/lib/Gradient.js')
        .then(m => { inst = new (m.Gradient || m.default)(); inst.initGradient('#' + c.id); })
        .catch(() => fail(root, 'CDN blocked')); },
    stop(){ try { inst && inst.pause(); } catch {} },
  };
};

function fail(root, text){
  const n = document.createElement('div'); n.className = 'fail'; n.textContent = text;
  root.appendChild(n);
}

/* ---- the set ------------------------------------------------------------ */
const V = (e, rt, note) => ({ lib: 'Vanta.js', licence: 'MIT',
  kb: rt === 'p5' ? '1029 KB + 11 KB' : '616 KB + 13 KB',
  src: 'https://www.vantajs.com/', note, mount: vanta(e, rt) });

const GROUNDS = [
  { id:'net',      name:'Vanta · Net',       ...V('net', 'three', 'linked points, the default everyone knows') },
  { id:'fog',      name:'Vanta · Fog',       ...V('fog', 'three', 'drifting colour fog') },
  { id:'waves',    name:'Vanta · Waves',     ...V('waves', 'three', 'a lit 3D water plane') },
  { id:'globe',    name:'Vanta · Globe',     ...V('globe', 'three', 'a rotating point globe') },
  { id:'cells',    name:'Vanta · Cells',     ...V('cells', 'three', 'organic cell division') },
  { id:'clouds2',  name:'Vanta · Clouds2',   ...V('clouds2', 'three', 'volumetric cloud plane') },
  { id:'birds',    name:'Vanta · Birds',     ...V('birds', 'three', 'boids flocking') },
  { id:'halo',     name:'Vanta · Halo',      ...V('halo', 'three', 'a warped bloom ring') },
  { id:'rings',    name:'Vanta · Rings',     ...V('rings', 'three', 'concentric orbit rings') },
  { id:'dots',     name:'Vanta · Dots',      ...V('dots', 'three', 'a dot lattice in depth') },
  { id:'ripple',   name:'Vanta · Ripple',    ...V('ripple', 'three', 'surface ripples') },
  { id:'topology', name:'Vanta · Topology',  ...V('topology', 'p5', 'growing contour lines') },
  { id:'trunk',    name:'Vanta · Trunk',     ...V('trunk', 'p5', 'branching ink') },

  { id:'ts-links', name:'tsParticles · Links', lib:'tsParticles', licence:'MIT', kb:'96 KB',
    src:'https://particles.js.org/', note:'the classic linked-particle field, interactive',
    mount: tsparticles('links', 'links', 'loadLinksPreset', { ...TS_BASE, preset: 'links' }) },
  { id:'ts-sea',   name:'tsParticles · Sea anemone', lib:'tsParticles', licence:'MIT', kb:'101 KB',
    src:'https://particles.js.org/samples/', note:'their own preset, tentacle growth',
    mount: tsparticles('sea-anemone', 'seaAnemone', 'loadSeaAnemonePreset', { ...TS_BASE, preset: 'seaAnemone' }) },
  { id:'ts-stars', name:'tsParticles · Stars', lib:'tsParticles', licence:'MIT', kb:'88 KB',
    src:'https://particles.js.org/samples/', note:'a slow starfield',
    mount: tsparticles('stars', 'stars', 'loadStarsPreset', { ...TS_BASE, preset: 'stars' }) },

  { id:'granim',   name:'Granim.js', lib:'granim.js', licence:'MIT', kb:'21 KB',
    src:'https://sarcadass.github.io/granim.js/', note:'canvas gradient cycling, no WebGL',
    mount: granim },
  { id:'trianglify', name:'Trianglify', lib:'trianglify', licence:'GPL-3.0', kb:'53 KB',
    src:'https://trianglify.io/', note:'low-poly SVG, static, one render', mount: trianglify },
  { id:'whatamesh', name:'Whatamesh', lib:'whatamesh', licence:'none', kb:'41 KB',
    src:'https://whatamesh.vercel.app/', note:'Stripe’s mesh gradient, reimplemented',
    mount: whatamesh },
];

/* ---- catalogues that cannot run here ------------------------------------
   React plus Tailwind, or a hosted runtime. The landing site is static HTML, so these are
   links to their own live demos rather than cards. The Mini App in src/ IS React 19, which is
   where any of them could actually land. */
const LINKS = [
  ['React Bits', 'https://reactbits.dev/', '47k stars. Aurora, Silk, Threads, Liquid Chrome, Prism, Dither, Light Rays, Plasma, Squares, Balatro, Galaxy. Licence reads NOASSERTION on GitHub, so check it.'],
  ['Paper Design · Shaders', 'https://shaders.paper.design/', 'Apache-2.0. Mesh gradient, grain gradient, liquid metal, dithering, god rays, fluted glass, metaballs, warp, water. Has a playground that emits the config.'],
  ['Aceternity UI', 'https://ui.aceternity.com/components', 'Aurora Background, Background Beams, Vortex, Wavy Background, Spotlight, Meteors, Lamp.'],
  ['Magic UI', 'https://magicui.design/docs/components/particles', 'Particles, Retro Grid, Dot Pattern, Ripple, Flickering Grid, Warp Background.'],
  ['21st.dev', 'https://21st.dev/community/components/explore/hero-background-animation', 'A community index of hero background components, filterable.'],
  ['ShaderGradient', 'https://www.shadergradient.co/', 'The Stripe-style gradient with a real editor, React and Framer.'],
  ['Spline', 'https://spline.design/', 'The closest thing to the reference you sent: real 3D scenes, a community library to fork, and a web runtime to embed.'],
  ['Rive community', 'https://rive.app/community/', 'Designed motion files with a small runtime, far cheaper than video.'],
  ['LottieFiles backgrounds', 'https://lottiefiles.com/free-animations/background', 'Free Lottie loops. The site already ships the player for its icons.'],
  ['Haikei', 'https://haikei.app/', 'Generates static SVG backgrounds: blobs, waves, stacked waves, low poly grid. Export and self-host, zero runtime.'],
  ['Hero Patterns', 'https://heropatterns.com/', 'MIT SVG tiling patterns, the cheapest thing on this list.'],
  ['Codrops', 'https://tympanus.net/codrops/category/playground/', 'Per-demo source for the more ambitious WebGL hero experiments.'],
  ['Unicorn Studio', 'https://www.unicorn.studio/', 'Hosted WebGL scene builder with an embed runtime.'],
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
    <div class="ground" aria-hidden="true"></div>
    <div class="tag"><b>${g.name}</b><span>${g.note}</span>
      <a href="${g.src}" target="_blank" rel="noopener">source</a>
      <span class="lic ${g.licence === 'MIT' ? 'ok' : 'warn'}">${g.licence}</span>
      <span class="kb">${g.kb}</span></div>
    <div class="card-body"><h2 class="display"></h2><p></p><a class="btn btn-solid" href="#"></a></div>
  </section>`).join('');

document.getElementById('links').innerHTML = LINKS.map(([n, u, d]) =>
  `<li><a href="${u}" target="_blank" rel="noopener">${n}</a><span>${d}</span></li>`).join('');

const live = new Map();
for (const g of GROUNDS) live.set(g.id, g.mount(grid.querySelector(`.card[data-id="${g.id}"] .ground`)));

/* seventeen WebGL contexts on one page is not a test of any of them, and browsers cap the
   number anyway, so only what is on screen runs */
const io = new IntersectionObserver(es => { for (const e of es){
  const inst = live.get(e.target.dataset.id); if (!inst) continue;
  document.body.classList.contains('frozen') ? inst.stop() : (e.isIntersecting ? inst.start() : inst.stop());
} }, { rootMargin: '150px' });
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

for (const [id, cls] of [['t-full','full'], ['t-band','band']]){
  const b = document.getElementById(id);
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle(cls, on);
  });
}

/* The finding this button exists to show: not one of these libraries checks
   prefers-reduced-motion. Stopping them means tearing them down. */
const fb = document.getElementById('t-freeze');
fb.addEventListener('click', () => {
  const on = fb.getAttribute('aria-pressed') !== 'true';
  fb.setAttribute('aria-pressed', String(on));
  document.body.classList.toggle('frozen', on);
  for (const inst of live.values()) on ? inst.stop() : inst.start();
});
})();
