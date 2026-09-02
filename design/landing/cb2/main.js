/* TrustForex Cashback — cb2 "The share"
   Built on Version B's engine (Lenis + ScrollTrigger). Default CSS state is the finished state; JS only adds motion.
   Signature: one instrument — the eligible rebate as a bar, your share filling it — carried hero → mechanics → calculator. */
(() => {
  const html = document.documentElement;
  const q = new URLSearchParams(location.search);
  const REDUCE = q.get('reduce') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 767px)').matches;
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
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) { e.preventDefault(); return; }
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: -60 });
    else el.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
  }));

  /* ---------- the share instrument: one controller per instance ---------- */
  const LEVEL = { 10: 'Standard', 15: 'Silver', 20: 'Gold', 30: 'Diamond' };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const lots = v => (Number.isInteger(v) ? v : +v.toFixed(2)).toLocaleString('en-US');
  const share = el => {
    const tag = $1(el, '.si-tag'), base = $1(el, '.si-base');
    const ticks = [...$(el, '.si-ticks i')], chips = [...$(el, '.si-chips li')];
    let pct = null;
    const paint = (p, label) => {
      el.style.setProperty('--share', p / 100);
      ticks.forEach(t => t.classList.toggle('passed', +t.dataset.t <= p));
      chips.forEach(c => { const r = +c.dataset.rate; c.classList.toggle('lit', r < p); c.classList.toggle('is', r === p); });
      if (tag) { $1(tag, 'b').textContent = p + '%'; $1(tag, 'i').textContent = LEVEL[p] || ''; }
      if (base && label != null) base.textContent = label;
    };
    return {
      /* discrete steps; the label cross-fades (180ms) — never a counter */
      set(p, label, immediate) {
        if (immediate || REDUCE || pct === null || pct === p) { paint(p, label); pct = p; return; }
        el.classList.add('swap');
        setTimeout(() => { paint(p, label); el.classList.remove('swap'); }, 180);
        pct = p;
      },
      base(frac, label) {
        el.style.setProperty('--base', Math.max(.04, Math.min(1, frac)));
        if (base && label != null) base.textContent = label;
      },
      empty(on) { el.classList.toggle('si-empty', on); }
    };
  };

  /* ---------- hero: the share steps 10 → 15 → 20 → 30 with scroll ---------- */
  const heroSi = share(document.getElementById('si-hero'));
  const SEQ = [10, 15, 20, 30];
  if (REDUCE) heroSi.set(30, null, true);
  else if (MOBILE) {
    heroSi.set(10, null, true);
    ScrollTrigger.create({ trigger: '#si-hero', start: 'top 85%', once: true, onEnter: () => SEQ.slice(1).forEach((p, i) => setTimeout(() => heroSi.set(p), 750 * (i + 1))) });
  } else {
    heroSi.set(10, null, true);
    let cur = 0;
    ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom bottom', onUpdate: st => {
      const p = st.progress, i = p < .2 ? 0 : p < .46 ? 1 : p < .72 ? 2 : 3;
      if (i !== cur) { cur = i; heroSi.set(SEQ[i]); }
    } });
  }

  /* ---------- headline: words mask-rise on load, then the underline draws ---------- */
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
  const h1 = document.getElementById('h1');
  wrapWords(h1);
  $(h1, '.ul .w').forEach(w => { const nx = w.nextSibling; if (nx && nx.nodeType === 3) { w.firstChild.textContent += ' '; nx.remove(); } });
  const intro = () => {
    if (REDUCE) { h1.classList.add('on'); return; }
    gsap.set($(h1, '.wi'), { yPercent: 110 });
    gsap.set('.intro', { opacity: 0, y: 14 });
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to($(h1, '.wi'), { yPercent: 0, duration: 1.1, stagger: .05 }, .05)
      .add(() => h1.classList.add('on'), .55)
      .to('.intro', { opacity: 1, y: 0, duration: .9, stagger: .12 }, .5);
  };
  document.fonts.ready.then(intro);

  /* ---------- chapters: words turn from grey to navy as they scroll in ---------- */
  document.querySelectorAll('.chapter .words').forEach(h => {
    wrapWords(h);
    if (REDUCE) return;
    const ws = $(h, '.wi');
    gsap.set(ws, { color: GREY });
    gsap.to(ws, { color: NAVY, stagger: .12, duration: .4, ease: 'none', scrollTrigger: { trigger: h, start: 'top 88%', end: 'top 34%', scrub: true } });
  });

  /* ---------- once-reveals that need a class (the four ticks) ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.claim').forEach(el => io.observe(el));

  /* ---------- reveal fallback where scroll timelines are unsupported ---------- */
  if (!VIEW_TL && !REDUCE) {
    gsap.set('.rv', { opacity: 0, y: 22 });
    ScrollTrigger.batch('.rv', { start: 'top 90%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .07, overwrite: true }) });
  }

  /* ---------- meaning: the two records slide apart from the one trade, once ---------- */
  const cards = gsap.utils.toArray('.split-card');
  if (!REDUCE && cards.length === 2) {
    gsap.set(cards[0], { x: 56, opacity: 0 }); gsap.set(cards[1], { x: -56, opacity: 0 });
    gsap.set('.split-conn', { scaleY: 0, transformOrigin: '50% 0' });
    ScrollTrigger.create({ trigger: '.split', start: 'top 78%', once: true, onEnter: () => gsap.timeline()
      .to('.split-conn', { scaleY: 1, duration: .5, ease: 'power2.out' })
      .to(cards, { x: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: .08 }, .25) });
  }

  /* ---------- mechanics: the instrument changes one dimension per step ---------- */
  const stage = document.getElementById('mech-stage');
  const mechSi = share(document.getElementById('si-mech'));
  const credit = $1(stage, '.si-credit');
  const foldChips = $1(stage, '.fold-chips'), foldLedger = $1(stage, '.fold-ledger');
  let grow = 0, flight = null, land = 0;
  const SRC = 'GTCFX · Standard account', VOL = '50 lots · Standard ×1';
  const hideLedger = () => {
    clearTimeout(land);
    foldLedger.classList.add('shut'); foldLedger.classList.remove('free');
    if (flight) { flight.kill(); flight = null; }
    gsap.set(credit, { clearProps: 'transform,opacity' });
  };
  const showLedger = () => {
    if (!foldLedger.classList.contains('shut')) return;
    foldLedger.classList.remove('shut');
    /* the filled share detaches as the weekly credit and lands in the balance row */
    land = setTimeout(() => {
      foldLedger.classList.add('free');
      const fr = $1(stage, '.si-fill').getBoundingClientRect(), cr = credit.getBoundingClientRect();
      flight = gsap.fromTo(credit, { x: fr.right - cr.left + 12, y: fr.top - cr.top + (fr.height - cr.height) / 2, opacity: 0 },
        { x: 0, y: 0, opacity: 1, duration: 1.1, ease: 'expo.out' });
    }, 700);
  };
  const STEP = [
    () => { clearTimeout(grow); mechSi.empty(true); mechSi.set(0, SRC, true); mechSi.base(1, SRC); foldChips.classList.add('shut'); hideLedger(); },
    () => { clearTimeout(grow); mechSi.empty(false); mechSi.set(10, SRC); mechSi.base(1, SRC); foldChips.classList.remove('shut'); hideLedger(); },
    () => { mechSi.empty(false); mechSi.set(10); mechSi.base(.4, '20 lots · Standard ×1'); clearTimeout(grow); grow = setTimeout(() => mechSi.base(1, VOL), 950); foldChips.classList.remove('shut'); hideLedger(); },
    () => { clearTimeout(grow); mechSi.empty(false); mechSi.base(1, VOL); mechSi.set(30, VOL); foldChips.classList.remove('shut'); showLedger(); }
  ];
  if (!REDUCE) {
    STEP[0]();
    gsap.utils.toArray('.mstep').forEach((el, i) => ScrollTrigger.create({ trigger: el, start: 'top 62%', end: 'bottom 62%', onEnter: () => STEP[i](), onEnterBack: () => STEP[i]() }));
  }

  /* ---------- calculator: the instrument, live (the form drives it) ---------- */
  const calcSi = share(document.getElementById('si-calc'));
  const account = document.getElementById('account'), volume = document.getElementById('volume');
  const levels = [...document.querySelectorAll('.level')], est = document.getElementById('estimate');
  let rate = 10;
  const recalc = first => {
    const v = Math.max(0, Number(volume.value || 0)), f = Number(account.value || 1);
    const value = Math.round(v * 17 * f * rate / 100);
    calcSi.base(v * f / 50, `${lots(v)} lots · ${account.selectedOptions[0].text} ×${f}`);
    calcSi.set(rate, null, first);
    const apply = () => { est.innerHTML = money(value) + ' <em>/ month</em>'; };
    if (first || REDUCE) return apply();
    est.classList.add('swap');
    setTimeout(() => { apply(); est.classList.remove('swap'); }, 180);
  };
  levels.forEach(b => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    levels.forEach(l => l.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    rate = Number(b.dataset.rate);
    recalc();
  }));
  volume.addEventListener('input', () => recalc());
  account.addEventListener('change', () => recalc());
  document.getElementById('broker').addEventListener('change', () => recalc());
  recalc(true);

  /* ---------- FAQ ---------- */
  document.querySelectorAll('.faq-q').forEach(btn => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open);
    btn.closest('.faq-item').classList.toggle('open', open);
    if (!REDUCE) setTimeout(() => ScrollTrigger.refresh(), 520);
  }));

  /* ---------- nav ---------- */
  ScrollTrigger.create({ start: 60, end: 'max', toggleClass: { targets: '#nav', className: 'is-scrolled' } });

  document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
  window.__ready = true;
})();
