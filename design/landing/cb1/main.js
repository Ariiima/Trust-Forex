/* TrustForex Cashback — cb1 "Two records"
   Version B's engine (Lenis + ScrollTrigger). Default CSS state is the settled state; JS only adds motion.
   Signature: one trade card splits along a hairline into a Market record and a Cashback record while the hero
   copy hands off to the Meaning copy; the mechanics write four lines into a sticky Cashback record. */
(() => {
  const html = document.documentElement;
  const q = new URLSearchParams(location.search);
  const REDUCE = q.get('reduce') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 767px)').matches;
  const STACKED = matchMedia('(max-width: 1023px)').matches;   /* the mechanics stage is no longer sticky */
  const VIEW_TL = CSS.supports('animation-timeline: view()');
  const GREY = '#C3C9D6', NAVY = '#0F2044';
  html.classList.add('js');
  if (REDUCE) html.classList.add('reduce');
  gsap.registerPlugin(ScrollTrigger, Flip);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const $ = (root, s) => root.querySelectorAll(s);
  const $1 = (root, s) => root.querySelector(s);
  const PINNED = !REDUCE && !MOBILE;                 /* the hero pin exists only here */

  /* ---------- smooth scroll (skipped under reduced motion) ---------- */
  let lenis = null;
  if (!REDUCE) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  window.__lenis = lenis;
  const hero = document.getElementById('hero');
  const scrollToY = y => lenis ? lenis.scrollTo(y) : window.scrollTo({ top: y, behavior: REDUCE ? 'auto' : 'smooth' });
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) { e.preventDefault(); return; }
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    /* In pinned mode the Meaning copy lives inside the sticky hero: its "position" is the end of the pin. */
    if (id === '#meaning' && PINNED) { scrollToY(hero.offsetTop + hero.offsetHeight - innerHeight); return; }
    if (lenis) lenis.scrollTo(el, { offset: -60 });
    else el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
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

  /* ---------- hero intro: headline word by word, the trade card rises ---------- */
  const h1 = document.getElementById('h1');
  wrapWords(h1);
  $(h1, '.ul .w').forEach(w => { const nx = w.nextSibling; if (nx && nx.nodeType === 3) { w.firstChild.textContent += ' '; nx.remove(); } });
  const split = document.getElementById('split');
  const intro = () => {
    if (REDUCE) { h1.classList.add('on'); return; }
    gsap.set($(h1, '.wi'), { color: GREY });
    gsap.set('.intro', { opacity: 0, y: 14 });
    gsap.set(split, { opacity: 0, y: 26 });
    gsap.timeline({ defaults: { ease: 'power2.out' } })
      .to($(h1, '.wi'), { color: NAVY, duration: .5, stagger: .07 }, .1)
      .add(() => h1.classList.add('on'), .8)
      .to('.intro', { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .1 }, .6)
      .to(split, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' }, .75);
  };
  document.fonts.ready.then(intro);

  /* ---------- the split: one card → two records, the hero copy hands off to the Meaning copy ---------- */
  const halfL = document.getElementById('half-l'), halfR = document.getElementById('half-r');
  const spine = document.getElementById('spine');
  const faceOne = gsap.utils.toArray('.face-one'), faceRec = gsap.utils.toArray('.face-rec');
  const heroCopy = document.getElementById('hero-copy'), meaning = document.getElementById('meaning');
  if (PINNED) {
    const gap = parseFloat(getComputedStyle(split).columnGap) || 60;
    /* the unsplit state: halves abut, the trade shows on both faces, the right half is still white */
    /* +1px overlap: two composited edges meeting exactly leave an antialiased seam */
    const SHADOW_OFF = '0px 18px 44px -30px rgba(15,32,68,0)', SHADOW_ON = '0px 18px 44px -30px rgba(15,32,68,.22)';
    gsap.set(halfL, { x: gap / 2 + 1, borderRadius: '22px 0px 0px 22px', borderRightWidth: 0, boxShadow: SHADOW_OFF });
    gsap.set(halfR, { x: -gap / 2 - 1, borderRadius: '0px 22px 22px 0px', borderLeftWidth: 0, backgroundColor: '#fff', borderColor: '#DFE2EA', boxShadow: SHADOW_OFF });
    gsap.set(faceOne, { opacity: 1 });
    gsap.set(faceRec, { opacity: 0 });
    gsap.set(spine, { scaleY: 0 });
    gsap.set(meaning, { autoAlpha: 0, y: 24 });
    const tl = gsap.timeline({ defaults: { ease: 'none' } });
    tl.to(spine, { scaleY: 1, duration: .12, ease: 'power1.inOut' }, .06)
      .to([halfL, halfR], { x: 0, duration: .3, ease: 'power2.inOut' }, .16)
      .to([halfL, halfR], { boxShadow: SHADOW_ON, duration: .24 }, .2)      /* the halves lift as they part */
      .to(halfL, { borderRadius: '22px 22px 22px 22px', borderRightWidth: 1, duration: .2 }, .18)
      .to(halfR, { borderRadius: '22px 22px 22px 22px', borderLeftWidth: 1, backgroundColor: NAVY, borderColor: NAVY, duration: .2 }, .22)
      .to(faceOne, { opacity: 0, duration: .1 }, .18)
      .to(faceRec, { opacity: 1, duration: .16 }, .3)
      .to(heroCopy, { autoAlpha: 0, y: -24, duration: .14, ease: 'power1.in' }, .56)
      .to(meaning, { autoAlpha: 1, y: 0, duration: .18, ease: 'power1.out' }, .66)
      .to({}, { duration: .16 });
    ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', scrub: .6, animation: tl });
  }

  /* ---------- once-reveals that need a class (ticks, dividers) ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.claim, .divider').forEach(el => io.observe(el));

  /* ---------- reveal fallback where scroll timelines are unsupported ---------- */
  if (!VIEW_TL && !REDUCE) {
    const rv = gsap.utils.toArray('.rv').filter(el => !hero.contains(el));
    gsap.set(rv, { opacity: 0, y: 22 });
    ScrollTrigger.batch(rv, { start: 'top 90%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .07, overwrite: true }) });
  }

  /* ---------- mechanics: four steps write four lines into the Cashback record ---------- */
  const steps = gsap.utils.toArray('.mech-step');
  const lines = gsap.utils.toArray('.ledger-line');
  const details = gsap.utils.toArray('.mech-step .detail-card');
  const stage = document.getElementById('detail');
  const write = upTo => lines.forEach((l, i) => l.classList.toggle('is-written', i <= upTo));
  if (!REDUCE && !STACKED) {
    /* the details move into the sticky stage and cross-fade per step; the lines are written as each step arrives */
    details.forEach(d => stage.appendChild(d));
    let current = -1;
    const show = i => {
      if (i === current) return;
      current = i;
      details.forEach((d, k) => d.classList.toggle('is-on', k === i));
      write(i);
    };
    steps.forEach((s, i) => ScrollTrigger.create({
      trigger: s, start: 'top 62%', end: 'bottom 62%',
      onEnter: () => show(i), onEnterBack: () => show(i),
      onLeaveBack: () => { if (i === 0) { current = -1; details.forEach(d => d.classList.remove('is-on')); write(-1); } }
    }));
    ScrollTrigger.create({ trigger: '#mechanics', start: 'top 62%', onEnter: () => { if (current < 0) show(0); }, once: true });
  } else if (!REDUCE) {
    /* stacked layouts: the ledger arrives once, its lines written in order */
    const ledger = document.getElementById('ledger');
    const wio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      lines.forEach((l, i) => setTimeout(() => l.classList.add('is-written'), 140 * i));
      wio.unobserve(e.target);
    }), { rootMargin: '0px 0px -10% 0px' });
    wio.observe(ledger);
  }

  /* ---------- calculator: the estimate line cross-fades, never counts ---------- */
  let selectedRate = 10;
  const estLine = $1(document, '.est-line'), estimate = document.getElementById('estimate');
  const volume = document.getElementById('volume'), account = document.getElementById('account');
  const value = () => {
    const v = Math.max(0, Number(volume.value || 0));
    const f = Number(account.value || 1);
    return Math.round(v * 17 * f * (selectedRate / 100));
  };
  const render = () => { estimate.textContent = '$' + value().toLocaleString('en-US'); };
  let swapTimer = 0;
  const recalculate = () => {
    if (REDUCE) return render();
    clearTimeout(swapTimer);
    estLine.classList.add('swap');
    swapTimer = setTimeout(() => { render(); estLine.classList.remove('swap'); }, 180);
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
