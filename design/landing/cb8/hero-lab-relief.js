/* Hero ground lab — relief. Lab only; nothing here ships.

   The reference the founder sent is a rendered 3D asset: beveled tiles with currency glyphs
   pressed into them, lit from the top left. None of that needs a render or a stock licence.
   An SVG filter reads the ALPHA of whatever is drawn as a height map, so a flat vector tile
   blurred and then lit by feSpecularLighting plus feDiffuseLighting comes back as metal.
   Everything below is that one trick applied to twelve different surfaces, in the brand ramp.

   All twelve are static, so reduced motion costs nothing: there is nothing to freeze. The cost
   is paint, not bytes — a full-screen filter is rasterised once, and each ground is under 4 KB
   of markup generated here. */
(() => {
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const W = 1440, H = 900;
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---- the lighting rigs ----------------------------------------------------
   raise  = the surface stands proud of the field (tiles, bars, coins)
   sink   = the same rig with the light reversed, so the art is cut INTO the field
   cast   = no art at all: turbulence is the height map, which is how metal gets its grain */
const FILTERS = `
<filter id="raise" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/>
  <feSpecularLighting in="b" surfaceScale="9" specularConstant="1.05" specularExponent="19" lighting-color="#d8e5ff" result="s">
    <feDistantLight azimuth="228" elevation="56"/></feSpecularLighting>
  <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
  <feDiffuseLighting in="b" surfaceScale="9" diffuseConstant="1" lighting-color="#93aee2" result="d">
    <feDistantLight azimuth="228" elevation="56"/></feDiffuseLighting>
  <feComposite in="d" in2="SourceAlpha" operator="in" result="d2"/>
  <feBlend in="SourceGraphic" in2="d2" mode="multiply" result="m"/>
  <feComposite in="s2" in2="m" operator="arithmetic" k2="1" k3="1"/>
</filter>
<filter id="sink" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b"/>
  <feSpecularLighting in="b" surfaceScale="-8" specularConstant="1" specularExponent="22" lighting-color="#cfe0ff" result="s">
    <feDistantLight azimuth="228" elevation="58"/></feSpecularLighting>
  <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
  <feDiffuseLighting in="b" surfaceScale="-8" diffuseConstant="1" lighting-color="#7e99d4" result="d">
    <feDistantLight azimuth="228" elevation="58"/></feDiffuseLighting>
  <feComposite in="d" in2="SourceAlpha" operator="in" result="d2"/>
  <feBlend in="SourceGraphic" in2="d2" mode="multiply" result="m"/>
  <feComposite in="s2" in2="m" operator="arithmetic" k2="1" k3="1"/>
</filter>
<filter id="gold" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/>
  <feSpecularLighting in="b" surfaceScale="10" specularConstant="1.3" specularExponent="16" lighting-color="#fff0c2" result="s">
    <feDistantLight azimuth="228" elevation="54"/></feSpecularLighting>
  <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
  <feDiffuseLighting in="b" surfaceScale="10" diffuseConstant="1" lighting-color="#caa14e" result="d">
    <feDistantLight azimuth="228" elevation="54"/></feDiffuseLighting>
  <feComposite in="d" in2="SourceAlpha" operator="in" result="d2"/>
  <feBlend in="SourceGraphic" in2="d2" mode="multiply" result="m"/>
  <feComposite in="s2" in2="m" operator="arithmetic" k2="1" k3="1"/>
</filter>
<filter id="cast" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.9 0.012" numOctaves="3" seed="4" result="n"/>
  <feDiffuseLighting in="n" surfaceScale="2.2" diffuseConstant="1" lighting-color="#7f9ad6" result="d">
    <feDistantLight azimuth="228" elevation="62"/></feDiffuseLighting>
  <feComposite in="d" in2="SourceAlpha" operator="in"/>
</filter>
<filter id="sinkfine" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="b"/>
  <feSpecularLighting in="b" surfaceScale="-3.4" specularConstant="1.1" specularExponent="26" lighting-color="#e2ecff" result="s">
    <feDistantLight azimuth="228" elevation="60"/></feSpecularLighting>
  <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
  <feDiffuseLighting in="b" surfaceScale="-3.4" diffuseConstant="1" lighting-color="#8aa6df" result="d">
    <feDistantLight azimuth="228" elevation="60"/></feDiffuseLighting>
  <feComposite in="d" in2="SourceAlpha" operator="in" result="d2"/>
  <feBlend in="SourceGraphic" in2="d2" mode="multiply" result="m"/>
  <feComposite in="s2" in2="m" operator="arithmetic" k2="1" k3="1"/>
</filter>
<linearGradient id="steel" x1="0" y1="0" x2="0.3" y2="1">
  <stop offset="0%" stop-color="#1B3F8E"/><stop offset="55%" stop-color="#12306F"/><stop offset="100%" stop-color="#0A1F4E"/>
</linearGradient>
<linearGradient id="bullion" x1="0" y1="0" x2="0.3" y2="1">
  <stop offset="0%" stop-color="#8C6C25"/><stop offset="55%" stop-color="#6A5019"/><stop offset="100%" stop-color="#3E2E0C"/>
</linearGradient>`;

const svg = (inner, extra = '') => `<svg class="relief" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>${FILTERS}${extra}</defs>${inner}</svg>`;

/* ---- geometry helpers ---------------------------------------------------- */
const hex = (cx, cy, r) => {
  const p = [];
  for (let i = 0; i < 6; i++){ const a = Math.PI / 180 * (60 * i);
    p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
  return 'M' + p.join('L') + 'Z';
};
const hexGrid = (r, gap) => {
  const dx = r * 1.5, dy = r * Math.sqrt(3), out = [];
  for (let col = -1; col * dx < W + r; col++)
    for (let row = -1; row * dy < H + r; row++)
      out.push({ x: col * dx, y: row * dy + (col % 2 ? dy / 2 : 0), r: r - gap });
  return out;
};

/* ---- the twelve ---------------------------------------------------------- */
const GLYPHS = ['$', '€', '£', '¥', '₣', '₿'];

/* r01 · Hex — the reference, in the brand ramp. Tiles stand proud, a handful carry a currency
   glyph cut into the face, and the rest are blank so the field does not turn into wallpaper. */
function hexField(gold){
  const rnd = mulberry32(3), cells = hexGrid(132, 6);
  const tiles = cells.map(c => `<path d="${hex(c.x, c.y, c.r)}"/>`).join('');
  const marks = cells.filter(() => rnd() < .16).map(c =>
    `<text x="${c.x.toFixed(0)}" y="${(c.y + 42).toFixed(0)}" text-anchor="middle"
       font-family="Inter,system-ui" font-weight="700" font-size="118">${GLYPHS[Math.floor(rnd() * 6)]}</text>`).join('');
  const fill = gold ? 'url(#bullion)' : 'url(#steel)';
  const fx = gold ? 'gold' : 'raise';
  return svg(`<g fill="${fill}" filter="url(#${fx})">${tiles}</g>
              <g fill="${fill}" filter="url(#sink)" opacity=".96">${marks}</g>`);
}

/* r03 · Ingots — bars stacked in rows, the XAUUSD version of the reference: the product is
   gold, so the tile is a bar rather than a hexagon. */
function ingots(){
  const rnd = mulberry32(8), out = [];
  for (let row = 0; row * 132 < H + 132; row++)
    for (let col = -1; col * 246 < W + 246; col++){
      const x = col * 246 + (row % 2 ? 123 : 0), y = row * 132;
      out.push(`<path d="M${x + 26} ${y} L${x + 200} ${y} L${x + 226} ${y + 104} L${x} ${y + 104} Z" rx="8"/>`);
    }
  const marks = out.filter(() => rnd() < .1).length;
  return svg(`<g fill="url(#bullion)" filter="url(#gold)">${out.join('')}</g>`);
}

/* r04 · Coins — discs with a milled rim, one lit. Reads as money without spelling it. */
function coins(){
  const rnd = mulberry32(12), disc = [], face = [];
  for (let cx = 0; cx < 5; cx++) for (let cy = 0; cy < 3; cy++){
    const x = Math.round((cx + .5) * W / 5 + (rnd() - .5) * 70);
    const y = Math.round((cy + .5) * H / 3 + (rnd() - .5) * 56);
    const r = Math.round(88 + rnd() * 30);
    disc.push(`<circle cx="${x}" cy="${y}" r="${r}"/>`);
    face.push(`<circle cx="${x}" cy="${y}" r="${Math.round(r * .78)}"/>`);
    face.push(`<text x="${x}" y="${y + Math.round(r * .26)}" text-anchor="middle"
      font-family="Inter,system-ui" font-weight="700" font-size="${Math.round(r * .8)}">${GLYPHS[(cx + cy) % 6]}</text>`);
  }
  return svg(`<g fill="url(#steel)" filter="url(#raise)">${disc.join('')}</g>
              <g fill="url(#steel)" filter="url(#sink)">${face.join('')}</g>`);
}

/* r05 · Guilloché — the engine-turned line-work on a banknote or a share certificate. The most
   literal drawing of "a record you can check" the site could carry, and it is pure maths. */
function guilloche(){
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const rose = (R, r, d, cx, cy, w) => {
    const turns = r / gcd(R, r), pts = [];
    for (let t = 0; t <= 6.2832 * turns; t += .02){
      pts.push(((R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t) + cx).toFixed(1) + ',' +
               ((R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t) + cy).toFixed(1));
    }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="#12306F" stroke-width="${w}"/>`;
  };
  const cx = W * .5, cy = H * .5, out = [];
  /* the ratio R/r decides the petal count, so it has to be a small fraction: 560/160 is 7/2
     and draws seven petals in two turns. Left irrational it draws noise, which is what a
     guilloche machine with a slipping gear also does. */
  for (let k = 0; k < 9; k++) out.push(rose(560, 160, 96 + k * 26, cx, cy, 2.2));
  for (let k = 0; k < 7; k++) out.push(rose(540, 120, 70 + k * 24, cx, cy, 2));
  for (let k = 0; k < 5; k++) out.push(rose(300, 100, 44 + k * 18, cx, cy, 1.8));
  out.push(`<circle cx="${cx}" cy="${cy}" r="430" fill="none" stroke="#12306F" stroke-width="3"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="446" fill="none" stroke="#12306F" stroke-width="1.6"/>`);
  return svg(`<rect width="${W}" height="${H}" fill="url(#steel)" filter="url(#cast)"/>
              <g filter="url(#sinkfine)">${out.join('')}</g>`);
}

/* r06 · Dial — concentric machining, the face of an instrument. Brushed, not drawn. */
function dial(){
  const rings = Array.from({ length: 46 }, (_, i) =>
    `<circle cx="${W * .5}" cy="${H * .46}" r="${40 + i * 26}" fill="none" stroke="#12306F" stroke-width="7"/>`).join('');
  return svg(`<g filter="url(#raise)">${rings}</g>`);
}

/* r07 · Knurl — the diamond grip cut into a machined handle, as a band across the foot. */
function knurl(){
  const a = [], b = [];
  for (let i = -30; i * 46 < W + 900; i++){
    a.push(`<path d="M${i * 46} ${H} L${i * 46 + 900} ${H - 900}" stroke="#12306F" stroke-width="13" fill="none"/>`);
    b.push(`<path d="M${i * 46} ${H - 900} L${i * 46 + 900} ${H}" stroke="#12306F" stroke-width="13" fill="none"/>`);
  }
  return svg(`<g filter="url(#raise)" opacity=".95"><g>${a.join('')}</g><g>${b.join('')}</g></g>`);
}

/* r08 · Blocks — squares extruded to different heights. The height map is literal here: a
   darker square is a lower one, so one flat drawing becomes a city. */
function blocks(){
  const rnd = mulberry32(19), out = [];
  for (let x = -1; x * 120 < W + 120; x++)
    for (let y = -1; y * 120 < H + 120; y++){
      const s = .55 + rnd() * .45;
      out.push(`<rect x="${x * 120 + 6}" y="${y * 120 + 6}" width="108" height="108" rx="10"
        fill="url(#steel)" opacity="${s.toFixed(2)}"/>`);
    }
  return svg(`<g filter="url(#raise)">${out.join('')}</g>`);
}

/* r09 · Scales — overlapping tiles, each one lit on its own curve. Softer than the hexagon and
   much harder to read as a crypto site, which the honeycomb always risks. */
function scales(){
  const out = [], rx = 116, ry = 92;
  for (let row = -1; row * ry * .78 < H + ry; row++)
    for (let col = -1; col * rx * 2 < W + rx * 2; col++){
      const x = col * rx * 2 + (row % 2 ? rx : 0), y = row * ry * .78;
      out.push(`<path d="M${x - rx} ${y} A${rx} ${ry} 0 0 0 ${x + rx} ${y} Z"/>`);
    }
  return svg(`<g fill="url(#steel)" filter="url(#raise)">${out.join('')}</g>`);
}

/* r10 · Mark — the TrustForex shield at the size of the screen, blind-debossed into the field.
   The brand as material rather than as a logo in the corner. */
function mark(){
  const d = 'M9.447 21.464l-.039-6.979c-.002-1.612-1.409-2.918-3.143-2.918H.259c.24 1.032.52 2.69.875 3.702 1.594 4.322 4.496 7.606 8.313 10.024z M18.037 11.567c-1.568 0-2.84 1.18-2.842 2.638v11.068c3.797-2.414 6.686-5.689 8.276-10.003.362-1.012.649-2.671.889-3.703z M24.615 5.29V3.216C20.628 1.712 16.646.61 12.424 0 8.128.602 4.013 1.717 0 3.263V5.29z';
  return svg(`<g filter="url(#sink)"><g transform="translate(${(W - 24.6 * 24.5) / 2} ${(H - 25.3 * 24.5) / 2}) scale(24.5)">
    <path d="${d}" fill="#12306F"/></g></g>`);
}

/* r11 · Glyphs — six currency marks at poster size, cut into the field and mostly cropped by
   it. The reference's idea with the tiles taken away. */
function glyphs(){
  const set = [['$', 120, 300, 380, -8], ['€', 560, 760, 300, 6], ['£', 1020, 260, 340, -4],
               ['¥', 1290, 720, 320, 10], ['₿', 760, 180, 190, -12], ['₣', 300, 820, 210, 5]];
  return svg(`<g filter="url(#sink)" fill="#12306F" font-family="Inter,system-ui" font-weight="700">${
    set.map(([g, x, y, s, rot]) =>
      `<text x="${x}" y="${y}" font-size="${s}" transform="rotate(${rot} ${x} ${y})">${g}</text>`).join('')}</g>`);
}

/* r12 · Cast — no art at all: turbulence is the height map, so the whole field becomes brushed
   metal. The cheapest of the twelve and the only one with no motif to get tired of. */
function cast(){
  return svg(`<rect width="${W}" height="${H}" fill="url(#steel)" filter="url(#cast)"/>`);
}


/* ---- the fusion: the product's own motifs, as material -------------------- */

/* r13 · Engraved — the record cut into the plate. Candlesticks and the trace line are the same
   shapes the still lab drew in light; here they are machined into metal instead of glowing on
   top of it, which is the one thing the reference site never does with its own subject. */
function engraved(){
  const rnd = mulberry32(6), bars = [];
  let v = .52;
  for (let i = 0; i < 16; i++){
    const o = v, c = Math.max(.12, Math.min(.88, o + (rnd() - .46) * .36));
    const hi = Math.max(o, c) + rnd() * .10, lo = Math.min(o, c) - rnd() * .10; v = c;
    const x = 30 + i * 90, Y = t => H * .30 + (1 - t) * H * .52;
    bars.push(`<rect x="${x + 28}" y="${Y(hi).toFixed(0)}" width="12" height="${(Y(lo) - Y(hi)).toFixed(0)}" rx="4"/>`);
    bars.push(`<rect x="${x}" y="${Y(Math.max(o, c)).toFixed(0)}" width="68" rx="4"
      height="${Math.max(40, Y(Math.min(o, c)) - Y(Math.max(o, c))).toFixed(0)}"/>`);
  }
  return svg(`<rect width="${W}" height="${H}" fill="url(#steel)" filter="url(#cast)"/>
              <g fill="#12306F" filter="url(#sink)">${bars.join('')}</g>`);
}

/* r14 · Ridge — the same line, the other way up: one rising trace standing proud of the plate,
   catching the light along its top edge the way a machined rib would. */
function ridge(){
  const pts = [];
  let v = .18;
  const rnd = mulberry32(15);
  for (let i = 0; i <= 30; i++){ v = Math.min(.92, v + .02 + rnd() * .035);
    pts.push(`${(i * W / 30).toFixed(0)},${(H * .92 - v * H * .52).toFixed(0)}`); }
  return svg(`<rect width="${W}" height="${H}" fill="url(#steel)" filter="url(#cast)"/>
    <g filter="url(#raise)"><polyline points="${pts.join(' ')}" fill="none" stroke="#12306F"
      stroke-width="30" stroke-linejoin="round" stroke-linecap="round"/></g>`);
}

/* r15 · Perforated — a punched sheet with the halo behind it, so the light arrives THROUGH the
   surface rather than on top of it. The only one here where the ground has a back. */
function perf(){
  const holes = [];
  for (let x = 0; x * 64 < W + 64; x++)
    for (let y = 0; y * 56 < H + 56; y++)
      holes.push(`<circle cx="${x * 64 + (y % 2 ? 32 : 0)}" cy="${y * 56}" r="15"/>`);
  return svg(`<rect width="${W}" height="${H}" fill="url(#steel)" filter="url(#cast)"/>
              <g fill="#0A1F4E" filter="url(#sink)">${holes.join('')}</g>`);
}

const GROUNDS = [
  { id:'r01', name:'Hex',        note:'the reference, in the brand ramp', build:() => hexField(false) },
  { id:'r02', name:'Hex gold',   note:'same tiles, bullion', warn:'off-palette', build:() => hexField(true) },
  { id:'r03', name:'Ingots',     note:'bars, because the product is gold', warn:'off-palette', build:ingots },
  { id:'r04', name:'Coins',      note:'milled discs, one lit', build:coins },
  { id:'r05', name:'Guilloché',  note:'banknote engine-turning, pure maths', build:guilloche },
  { id:'r06', name:'Dial',       note:'concentric machining', build:dial },
  { id:'r07', name:'Knurl',      note:'a machined grip', build:knurl },
  { id:'r08', name:'Blocks',     note:'squares extruded by height', build:blocks },
  { id:'r09', name:'Scales',     note:'overlapping tiles, softer than hex', build:scales },
  { id:'r10', name:'Mark',       note:'the shield blind-debossed', build:mark },
  { id:'r11', name:'Glyphs',     note:'currency marks at poster size', build:glyphs },
  { id:'r12', name:'Cast',       note:'turbulence as the height map', build:cast },
  { id:'r13', name:'Engraved',   note:'the record machined into the plate', build:engraved },
  { id:'r14', name:'Ridge',      note:'the trace standing proud of it', build:ridge },
  { id:'r15', name:'Perforated', note:'light arriving through the surface', build:perf },
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
    <div class="rayfield k ${g.id}" aria-hidden="true">${g.build()}<i></i><i></i><i></i><i></i></div>
    <div class="tag"><b>${g.id.slice(1)} · ${g.name}</b><span>${g.note}</span>${g.warn ? `<em>${g.warn}</em>` : ''}</div>
    <div class="card-body"><h2 class="display"></h2><p></p><a class="btn btn-solid" href="#"></a></div>
  </section>`).join('');

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

for (const [id, cls] of [['t-full','full'], ['t-band','band'], ['t-mirror','mirror'], ['t-scrim','noscrim']]){
  const b = document.getElementById(id);
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle(cls, on);
  });
}
})();
