/* TrustForex Cashback — cb4 "Already trading"
   Built on Version B's engine (Lenis + ScrollTrigger). Default CSS state is the finished state; JS only adds motion.
   Signature: the trader's own trade log never moves. Cashback switches on over it — the one state change on the page —
   and a second column slides in beside every trade. The four mechanics steps are layers over the same, unchanged log. */
(() => {
  const html = document.documentElement;
  const q = new URLSearchParams(location.search);
  const REDUCE = q.get('reduce') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DESK = matchMedia('(min-width: 1024px)').matches;
  const VIEW_TL = CSS.supports('animation-timeline: view()');
  const GREY = '#C3C9D6', NAVY = '#0F2044';
  html.classList.add('js');
  if (REDUCE) html.classList.add('reduce');
  gsap.registerPlugin(ScrollTrigger, Flip);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const $ = (root, s) => root.querySelectorAll(s);
  const $1 = (root, s) => root.querySelector(s);

  /* ---------- smooth scroll (skipped under reduced motion) ---------- */
  let lenis = null;
  if (!REDUCE) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  window.__lenis = lenis;
  const scrollTo = (target, offset) => {
    if (lenis) lenis.scrollTo(target, { offset: offset || 0 });
    else if (typeof target === 'number') window.scrollTo({ top: target, behavior: REDUCE ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
  };
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) { e.preventDefault(); return; }
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    scrollTo(el, -60);
  }));

  /* ---------- words: wrap every word so it can be revealed one by one ---------- */
  const wrapWords = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/([ \t\n]+)/).forEach(tok => {
          if (!tok) return;
          if (/^[ \t\n]+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const i = document.createElement('span'); i.className = 'wi'; i.textContent = tok;
          w.appendChild(i); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') wrapWords(n);
    });
  };

  /* ---------- hero: headline word by word, then the switch ---------- */
  const h1 = document.getElementById('h1');
  wrapWords(h1);
  $(h1, '.ul .w').forEach(w => { const nx = w.nextSibling; if (nx && nx.nodeType === 3) { w.firstChild.textContent += ' '; nx.remove(); } });
  const intro = () => {
    if (REDUCE) { h1.classList.add('on'); return; }
    gsap.set($(h1, '.wi'), { color: GREY });
    gsap.set('.intro', { opacity: 0, y: 14 });
    gsap.timeline({ defaults: { ease: 'power2.out' } })
      .to($(h1, '.wi'), { color: NAVY, duration: .5, stagger: .07 }, .1)
      .add(() => h1.classList.add('on'), .8)
      .to('.intro', { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .1 }, .6);
  };
  document.fonts.ready.then(intro);

  /* The log: markup is the finished state (Cashback on). JS primes "off" and builds the one state change. */
  const log = document.getElementById('hero-log');
  const sw = document.getElementById('sw');
  const knob = $1(sw, '.sw-knob'), track = $1(sw, '.sw-track'), swOff = $1(sw, '.sw-off'), swOn = $1(sw, '.sw-on');
  const credits = [...$(log, '.credit')], creditHead = $1(log, '.credit-head'), note = $1(log, '.log-note');
  const CW = getComputedStyle(log).getPropertyValue('--cw').trim() || '124px';
  const setChecked = on => { sw.setAttribute('aria-checked', String(on)); sw.classList.toggle('is-on', on); };
  const primeOff = () => {
    setChecked(false);
    gsap.set(knob, { x: 0 });
    gsap.set(track, { backgroundColor: GREY });
    gsap.set(swOff, { opacity: 1 }); gsap.set(swOn, { opacity: 0 });
    gsap.set(log, { '--cw': '0px' });
    gsap.set(credits, { opacity: 0, x: 14 });
    gsap.set([creditHead, note], { opacity: 0 });
  };
  /* at: the moment the switch flips, in timeline seconds (the timeline is 1s long when scrubbed) */
  const buildOn = (tl, at) => {
    tl.to(knob, { x: 18, duration: .06, ease: 'power2.inOut' }, at)
      .to(track, { backgroundColor: '#144CCD', duration: .06 }, at)
      .to(swOff, { opacity: 0, duration: .04 }, at)
      .to(swOn, { opacity: 1, duration: .04 }, at + .03)
      .to(log, { '--cw': CW, duration: .28, ease: 'power2.out' }, at + .05)
      .to(creditHead, { opacity: 1, duration: .12 }, at + .16)
      .to(credits, { opacity: 1, x: 0, duration: .18, ease: 'power2.out', stagger: .06 }, at + .14)
      .to(note, { opacity: 1, duration: .14 }, at + .48);
  };
  let heroST = null;
  if (!REDUCE && DESK) {
    primeOff();
    const tl = gsap.timeline({ defaults: { ease: 'none' } });
    buildOn(tl, .33);
    tl.to({}, { duration: .3 });                       /* hold the finished state before the pin releases */
    /* the scrub spans exactly the stuck period: the hero's height minus the sticky block's own height */
    const heroEl = document.getElementById('hero'), stickyEl = $1(heroEl, '.hero-sticky');
    heroST = ScrollTrigger.create({
      trigger: '#hero', start: 'top top', end: () => '+=' + Math.max(240, heroEl.offsetHeight - stickyEl.offsetHeight), scrub: .5, animation: tl, invalidateOnRefresh: true,
      onUpdate: st => { const on = st.progress > .34; if ((sw.getAttribute('aria-checked') === 'true') !== on) setChecked(on); }
    });
    /* clicking the switch scrolls to the state it asks for */
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') === 'true';
      scrollTo(on ? heroST.start : heroST.start + (heroST.end - heroST.start) * .75);
    });
  } else if (!REDUCE) {
    primeOff();
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    buildOn(tl, 0);
    tl.duration(1.3);
    ScrollTrigger.create({ trigger: log, start: 'top 78%', once: true, onEnter: () => setTimeout(() => { setChecked(true); tl.play(); }, 900) });
    sw.addEventListener('click', () => { const on = sw.getAttribute('aria-checked') === 'true'; setChecked(!on); on ? tl.reverse() : tl.play(); });
  } else {
    sw.addEventListener('click', () => { const on = sw.getAttribute('aria-checked') === 'true'; setChecked(!on); log.classList.toggle('is-off', on); });
  }

  /* ---------- chapters: words turn from grey to navy as they scroll in ---------- */
  document.querySelectorAll('.chapter .words').forEach(h => {
    wrapWords(h);
    if (REDUCE) return;
    const ws = $(h, '.wi');
    gsap.set(ws, { color: GREY });
    gsap.to(ws, { color: NAVY, stagger: .12, duration: .4, ease: 'none', scrollTrigger: { trigger: h, start: 'top 88%', end: 'top 34%', scrub: true } });
  });

  /* ---------- once-reveals that need a class (the ticks) ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.claim').forEach(el => io.observe(el));

  /* ---------- reveal fallback where scroll timelines are unsupported ---------- */
  if (!VIEW_TL && !REDUCE) {
    gsap.set('.rv', { opacity: 0, y: 22 });
    ScrollTrigger.batch('.rv', { start: 'top 90%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .07, overwrite: true }) });
  }

  /* ---------- mechanics: four layers over the unchanged log (desktop, motion on) ---------- */
  const layers = gsap.utils.toArray('.layer');
  const setLayer = i => layers.forEach((l, k) => { l.classList.toggle('is-on', k === i); l.classList.toggle('is-back', k < i); l.classList.toggle('is-next', k > i); });
  if (!REDUCE && DESK) {
    setLayer(0);
    /* a step owns the stage once its copy block has crossed the upper third — when the eye reaches its heading */
    gsap.utils.toArray('.mstep-copy').forEach((c, i) => ScrollTrigger.create({ trigger: c, start: 'top 32%', end: 'bottom 32%', onEnter: () => setLayer(i), onEnterBack: () => setLayer(i) }));
  }

  /* ---------- the calculator: the wireframe's inputs; the result cross-fades, never counts ---------- */
  let selectedRate = 10;
  const est = document.getElementById('estimate');
  const volume = document.getElementById('volume'), account = document.getElementById('account');
  const render = () => {
    const v = Math.max(0, Number(volume.value || 0));
    const f = Number(account.value || 1);
    const value = Math.round(v * 17 * f * (selectedRate / 100));
    est.innerHTML = '$' + value.toLocaleString('en-US') + ' <em>/ month</em>';
  };
  const recalculate = () => {
    if (REDUCE) return render();
    est.classList.add('swap');
    setTimeout(() => { render(); est.classList.remove('swap'); }, 180);
  };
  document.querySelectorAll('.level').forEach(b => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    document.querySelectorAll('.level').forEach(l => l.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    selectedRate = Number(b.dataset.rate);
    recalculate();
  }));
  volume.addEventListener('input', recalculate);
  account.addEventListener('change', recalculate);
  render();

  /* ---------- FAQ ---------- */
  document.querySelectorAll('.faq-q').forEach(btn => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open);
    btn.closest('.faq-item').classList.toggle('open', open);
    if (!REDUCE) setTimeout(() => ScrollTrigger.refresh(), 520);
  }));

  /* ---------- nav ---------- */
  ScrollTrigger.create({ start: 60, end: 'max', toggleClass: { targets: '#nav', className: 'is-scrolled' } });

  addEventListener('load', () => ScrollTrigger.refresh());
  window.__ready = true;
})();
