/* TrustForex Cashback — cb3 "Week by week"
   Built on Version B's engine (Lenis + ScrollTrigger). Default CSS state is the finished state; JS only adds motion.
   Signature: the dashboard's four weekly credits stack into history on load, each lighting its week;
   the mechanics are a rail that fills toward Week 1, one product panel per milestone. */
(() => {
  const html = document.documentElement;
  const q = new URLSearchParams(location.search);
  const REDUCE = q.get('reduce') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = matchMedia('(max-width: 1023px)').matches;
  const VIEW_TL = CSS.supports('animation-timeline: view()');
  const GREY = '#C3C9D6', NAVY = '#0F2044';
  html.classList.add('js');
  if (REDUCE) html.classList.add('reduce');
  gsap.registerPlugin(ScrollTrigger, Flip);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const $ = (root, s) => root.querySelectorAll(s);

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

  /* ---------- hero: headline words mask-rise, then the four credits stack into the history ---------- */
  const h1 = document.getElementById('h1');
  wrapWords(h1);
  $(h1, '.ul .w').forEach(w => { const nx = w.nextSibling; if (nx && nx.nodeType === 3) { w.firstChild.textContent += ' '; nx.remove(); } });
  const hrows = gsap.utils.toArray('#dash .hrow');
  const wks = gsap.utils.toArray('#strip .wk');
  const intro = () => {
    if (REDUCE) { h1.classList.add('on'); return; }
    gsap.set($(h1, '.wi'), { yPercent: 110 });
    gsap.set('.intro', { opacity: 0, y: 14 });
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to($(h1, '.wi'), { yPercent: 0, duration: 1.1, stagger: .05 }, .05)
      .add(() => h1.classList.add('on'), .55)
      .to('.intro', { opacity: 1, y: 0, duration: .9, stagger: .1 }, .5);
  };
  document.fonts.ready.then(intro);

  if (!REDUCE) {
    /* rows are hidden in place (no layout shift); the total $150.00 is never touched */
    wks.forEach(w => w.classList.remove('lit'));
    gsap.set(hrows, { autoAlpha: 0, y: 12 });
    const stackIn = () => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      /* oldest credit first: the bottom row lands, then the one above it — the history stacks upward, the weeks light left to right */
      hrows.slice().reverse().forEach((r, i) => {
        const t = .5 + i * .16;
        tl.to(r, { autoAlpha: 1, y: 0, duration: .75 }, t).add(() => wks[i].classList.add('lit'), t + .12);
      });
    };
    ScrollTrigger.create({ trigger: '#dash', start: 'top 85%', once: true, onEnter: () => document.fonts.ready.then(stackIn) });
  }

  /* ---------- chapters: words turn from dim to full as they scroll in (white on navy bands, navy on the still) ---------- */
  document.querySelectorAll('.chapter .words').forEach(h => {
    wrapWords(h);
    if (REDUCE) return;
    const onNavy = h.closest('.chapter').classList.contains('chapter-navy');
    const ws = $(h, '.wi');
    gsap.set(ws, { color: onNavy ? 'rgba(255,255,255,.28)' : GREY });
    gsap.to(ws, { color: onNavy ? '#fff' : NAVY, stagger: .12, duration: .4, ease: 'none', scrollTrigger: { trigger: h, start: 'top 88%', end: 'top 34%', scrub: true } });
  });

  /* ---------- once-reveals that need a class (ticks) ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.claim').forEach(el => io.observe(el));

  /* ---------- reveal fallback where scroll timelines are unsupported ---------- */
  if (!VIEW_TL && !REDUCE) {
    gsap.set('.rv', { opacity: 0, y: 22 });
    ScrollTrigger.batch('.rv', { start: 'top 90%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .07, overwrite: true }) });
  }

  /* ---------- mechanics: the rail fills toward Week 1; one product panel per milestone ---------- */
  const miles = gsap.utils.toArray('.mile[data-i]');
  const pps = gsap.utils.toArray('#stage .pp');
  const week1 = document.getElementById('week1');
  const lands = () => document.querySelectorAll('.credit-land');
  const setStep = i => {
    miles.forEach((m, k) => m.classList.toggle('is-on', k <= i));
    pps.forEach((p, k) => p.classList.toggle('is-on', k === i));
    lands().forEach(l => l.classList.toggle('in', i === 3));
  };
  if (!REDUCE) {
    if (MOBILE) {
      /* no sticky stage on narrow screens: each milestone carries its own copy of the panel, in reading order */
      pps.forEach((p, i) => {
        const c = p.cloneNode(true); c.classList.add('mile-panel', 'is-on'); c.removeAttribute('id');
        c.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        miles[i].appendChild(c);
      });
    }
    setStep(0);
    miles.forEach((m, i) => ScrollTrigger.create({ trigger: m, start: 'top 62%', end: 'bottom 62%', onToggle: s => { if (s.isActive) setStep(i); } }));
    ScrollTrigger.create({ trigger: week1, start: 'top 68%', onEnter: () => { week1.classList.add('is-on'); lands().forEach(l => l.classList.add('in')); }, onLeaveBack: () => week1.classList.remove('is-on') });
    gsap.fromTo('#rail-fill', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#rail-col', start: 'top 62%', end: 'bottom 68%', scrub: true } });
  }

  /* ---------- calculator: the wireframe's inputs and result; the number cross-fades, never counts ---------- */
  let selectedRate = 10;
  const est = document.getElementById('estimate');
  const volumeEl = document.getElementById('volume'), accountEl = document.getElementById('account');
  const recalculate = () => {
    const volume = Math.max(0, Number(volumeEl.value || 0));
    const factor = Number(accountEl.value || 1);
    const value = Math.round(volume * 17 * factor * (selectedRate / 100));
    const html = '$' + value.toLocaleString('en-US') + ' <em>/ month</em>';
    if (REDUCE || est.innerHTML === html) { est.innerHTML = html; return; }
    est.classList.add('swap');
    setTimeout(() => { est.innerHTML = html; est.classList.remove('swap'); }, 180);
  };
  document.querySelectorAll('.level').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.level').forEach(l => l.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    selectedRate = Number(btn.dataset.rate);
    recalculate();
  }));
  volumeEl.addEventListener('input', recalculate);
  accountEl.addEventListener('change', recalculate);
  recalculate();

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
