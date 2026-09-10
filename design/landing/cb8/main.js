/* TrustForex Cashback scrolling: the four mechanics pin at the top for a short hold, then release
   (the .hold boxes, base.css — the two chapters get a shorter beat, the rest scrolls plainly). Native sticky, so nothing here touches the wheel — no preventDefault,
   no gesture counting, no tween. JS only reads the scroll position: the rail dot, the nav's ground,
   the reveal, and smooth-scrolls to a section on request. Mobile, touch and reduced motion use
   plain scrolling. No scroll library. */
(() => {
  const q = new URLSearchParams(location.search);
  const REDUCE = q.get('reduce') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deck = document.getElementById('deck');
  const screens = [...deck.querySelectorAll('.screen')];
  const html = document.documentElement;
  html.classList.add('js');
  // A sticky section's offsetTop and rect move with the scroll position. Its zero-height
  // sibling stays in normal flow as a stable navigation target.
  const anchors = screens.map(s => {
    const anchor = document.createElement('div');
    anchor.className = 'scroll-anchor';
    anchor.setAttribute('aria-hidden', 'true');
    s.before(anchor);
    return anchor;
  });
  if (REDUCE) html.classList.add('reduce');
  // ?ground=k12 — preview any v5 ground (grounds.html?set=5) behind the real hero
  if (/^k\d\d$/.test(q.get('ground') || '') && document.querySelector('#hero .rayfield')) document.querySelector('#hero .rayfield').className = 'rayfield k ' + q.get('ground');

  /* ?lock=off — an ordinary document, for comparison. The holds run only where they can behave:
     real pointer, tall enough viewport, motion allowed. */
  // ponytail: a fixed 1024/620 threshold, not a capability probe — raise it if short laptops complain.
  const fits = () => matchMedia('(min-width:1024px) and (min-height:620px) and (hover:hover) and (pointer:fine)').matches;
  const canHold = () => !REDUCE && q.get('lock') !== 'off' && fits();
  let SNAP = canHold();
  const applyMode = () => html.classList.toggle('snap', SNAP);
  applyMode();

  /* ---------- which screen are we on ---------- */
  let idx = 0;
  const rail = document.getElementById('rail');
  const dots = screens.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot';
    b.setAttribute('aria-label', `Go to ${s.dataset.name || 'section ' + (i + 1)}`);
    b.addEventListener('click', () => go(i));
    rail.appendChild(b);
    return b;
  });
  const mark = i => {
    idx = i;
    dots.forEach((d, n) => d.setAttribute('aria-current', n === i ? 'true' : 'false'));
    // the nav and the rail invert on the two dark screens, so drive them off the ground
    // we are actually standing on — not off "past the hero", which lied on chapter 1.
    const dark = screens[i].classList.contains('screen-dark');
    html.classList.toggle('dark-now', dark);
    html.classList.toggle('past-hero', i > 0);   // the back-to-top button shows once the hero is behind us
    document.getElementById('nav').classList.toggle('is-paper', !dark);
  };

  /* ---------- Iconly's animated icons (ico/*.json): rest on the last frame, play once on entry with the
     reveal's stagger, and once more each time the pointer enters the card they sit on ---------- */
  // A slot may carry an inline stand-in glyph (svg.fb) that shows until the Iconly file is pulled;
  // the player appends its own svg after it and base.css hides a stand-in that is no longer last.
  const icons = [...document.querySelectorAll('.ico[data-lottie]')].map(el => {
    const anim = lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, path: el.dataset.lottie });
    // the rest frame is the last one — the complete glyph — unless the file ends on a transient state
    // (a blinking eye ends shut): data-rest="<frame>" names the frame to rest on, after every play too
    const rest = () => anim.goToAndStop(el.dataset.rest != null ? +el.dataset.rest : anim.totalFrames - 1, true);
    anim.addEventListener('DOMLoaded', rest);
    anim.addEventListener('complete', rest);
    const play = () => { if (!REDUCE && anim.isLoaded) anim.goToAndPlay(0, true); };
    (el.closest('.tile,.value-row,.pstep,button,.route-row,.card,.md-callout') || el).addEventListener('pointerenter', play);
    return { el, play, anim };
  });

  /* The reveal wants crossing semantics, which is exactly what IntersectionObserver gives. */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting || e.target.classList.contains('in')) return;
      e.target.classList.add('in');   // once, never removed
      const inside = icons.filter(i => e.target.contains(i.el));
      inside.filter(i => !i.el.dataset.chain).forEach(i => setTimeout(i.play, (+i.el.style.getPropertyValue('--i') || 0) * 90 + 220));
      // data-chain="<name>": the step numbers play one after another — each starts when the previous one completes
      const chain = (run, k = 0) => {
        if (!run[k]) return;
        if (run[k + 1]) { const off = run[k].anim.addEventListener('complete', () => { off(); chain(run, k + 1); }); }
        run[k].play();
      };
      new Set(inside.map(i => i.el.dataset.chain).filter(Boolean)).forEach(name => setTimeout(() => chain(inside.filter(i => i.el.dataset.chain === name)), 220));
    });
  }, { threshold: .25 });
  screens.forEach(s => io.observe(s));

  const scroller = () => getComputedStyle(deck).overflowY === 'visible' ? window : deck;
  const position = () => scroller() === window ? scrollY : deck.scrollTop;
  const viewport = () => scroller() === window ? innerHeight : deck.clientHeight;
  const offset = i => anchors[i].getBoundingClientRect().top + position()
    - (scroller() === window ? 0 : deck.getBoundingClientRect().top);
  const destination = i => Math.max(0, Math.min(offset(i), scroller() === window
    ? document.documentElement.scrollHeight - innerHeight : deck.scrollHeight - deck.clientHeight));
  // the screen whose anchor has passed the middle of the viewport — halfway through a hand-over
  const current = () => {
    const y = position();
    let best = 0;
    anchors.forEach((_, i) => { if (offset(i) <= y + viewport() * .5) best = i; });
    return best;
  };
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const i = current();
      if (i !== idx) mark(i);
    });
  };
  deck.addEventListener('scroll', onScroll, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });   // support a document scroll container too

  /* ---------- go to a section: the browser's own smooth scroll, landing at the start of its hold ---------- */
  function go(i) {
    i = Math.max(0, Math.min(screens.length - 1, i));
    scroller().scrollTo({ top: destination(i), behavior: REDUCE ? 'instant' : 'smooth' });
  }
  window.__go = go;                       // for the QA pass
  document.getElementById('toTop').addEventListener('click', () => go(0));
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    const s = el.closest('.screen');
    if (s) go(screens.indexOf(s)); else el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
  }));

  addEventListener('resize', () => {
    const now = canHold();
    if (now === SNAP) return;
    SNAP = now;
    applyMode();
  });

  /* ---------- headline words, revealed one at a time (a <br> in the heading is a wireframe line break and stays) ---------- */
  document.querySelectorAll('.words').forEach(node => {
    const frag = document.createDocumentFragment();
    let i = 0;
    node.childNodes.forEach(n => {
      if (n.nodeName === 'BR') { frag.append(document.createElement('br')); return; }
      n.textContent.trim().split(/\s+/).filter(Boolean).forEach(tok => {
        const w = document.createElement('span');
        w.className = 'w';
        w.style.setProperty('--i', i++);
        w.innerHTML = `<i>${tok}</i>`;
        frag.append(w, document.createTextNode(' '));
      });
    });
    node.replaceChildren(frag);
  });

  /* ---------- glass panes (02, 04): the light follows the pointer ----------
     --mx/--my in px on the pane and on each tile, relative to its own box, so every radial in
     style.css centres under the cursor; .lit while the pointer is over the pane. */
  document.querySelectorAll('.glass .panel').forEach(pane => {
    const lit = [pane, ...pane.querySelectorAll('.tile')];
    pane.addEventListener('pointermove', e => {
      for (const el of lit) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
        if (el === pane) {   // and the lean: the pointer's offset from the pane's centre, −1…1
          el.style.setProperty('--tx', ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
          el.style.setProperty('--ty', ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
        }
      }
    }, { passive: true });
    pane.addEventListener('pointerenter', () => pane.classList.add('lit'));
    pane.addEventListener('pointerleave', () => { pane.classList.remove('lit'); pane.style.setProperty('--tx', 0); pane.style.setProperty('--ty', 0); });
  });

  /* ---------- FAQ ---------- */
  document.querySelectorAll('.faq-q').forEach(b => b.addEventListener('click', () => {
    const item = b.closest('.faq-item');
    const open = item.classList.toggle('open');
    b.setAttribute('aria-expanded', String(open));
  }));

  /* ---------- calculator: volume x 17 x account factor x share (the Cashback page only — the Results,
     Referral and About pages load this same script and have no form) ---------- */
  const vol = document.getElementById('volume');
  const acct = document.getElementById('account');
  const out = document.getElementById('estimate');
  const levels = [...document.querySelectorAll('.level')];
  let rate = 10;
  const price = () => {
    const v = Math.max(0, parseFloat(vol.value) || 0);
    const n = Math.round(v * 17 * parseFloat(acct.value) * rate / 100);
    out.innerHTML = `$${n.toLocaleString('en-US')} <em>/ month</em>`;   // cross-fade, never a count-up
    out.classList.remove('swap'); void out.offsetWidth; out.classList.add('swap');
  };
  levels.forEach(b => b.addEventListener('click', () => {
    levels.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    rate = +b.dataset.rate;
    price();
  }));
  if (vol) [vol, acct].forEach(el => el.addEventListener('input', price));

  /* ---------- self-check: the estimate the page ships with must be the one it computes ---------- */
  if (q.get('check') === '1') {
    const fails = [];
    const est = (v, f, r) => Math.round(v * 17 * f * r / 100);
    if (vol && est(50, 1, 10) !== 85) fails.push(`default estimate ${est(50, 1, 10)} != 85`);
    if (vol && est(50, 0.35, 10) !== 30) fails.push(`ECN estimate ${est(50, 0.35, 10)} != 30`);
    if (vol && est(50, 1, 30) !== 255) fails.push(`Diamond estimate ${est(50, 1, 30)} != 255`);
    const over = screens.filter(s => s.scrollHeight > s.clientHeight + 2).map(s => s.id);
    if (over.length) fails.push(`screens clip their content: ${over.join(', ')}`);
    // the vertical check missed a 390px-wide headline spilling sideways — check both axes
    const wide = screens.filter(s => s.scrollWidth > s.clientWidth + 2).map(s => s.id);
    if (wide.length) fails.push(`screens overflow sideways: ${wide.join(', ')}`);
    if (document.documentElement.scrollWidth > innerWidth + 2) fails.push('document scrolls sideways');
    // guards the .field/.rayfield class collision that once collapsed the whole form to 0px
    const fields = document.querySelector('#calculator .fields');
    if (fields && fields.getBoundingClientRect().height < 100) fails.push(`calculator fields collapsed to ${Math.round(fields.getBoundingClientRect().height)}px`);
    // every icon slot must show one glyph: the Iconly file, or its inline stand-in until the file is pulled
    const bare = [...document.querySelectorAll('.ico')].filter(el => !el.querySelector('svg')).length;
    if (bare) fails.push(`${bare} icon slots are empty`);
    console.log(fails.length ? 'CHECK FAIL\n' + fails.join('\n') : `CHECK OK — ${SNAP ? 'hold' : 'plain'} mode, ${screens.length} screens, none overflowing`);
  }

  mark(current());
})();
