/* One page, four documents, one URL space. ?document= is the address an acceptance record
   points at, so a tab click pushes history rather than swapping content behind the reader's
   back, and Back returns to the document they came from. No framework, no fetch: every
   document is already in the HTML, which is also what makes the page printable offline.

   Nothing is hidden in the markup: without this file the page is all four documents, in order,
   as one long legal text. Hiding three of them is the enhancement, not the default — a legal
   page that renders blank when a script fails is the one failure this page cannot have. */
(() => {
  const docs = [...document.querySelectorAll('[data-doc]')];
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const row = document.querySelector('.doc-tabs-row');
  const valid = new Set(tabs.map(t => t.dataset.tab));
  const requested = () => {
    const key = new URLSearchParams(location.search).get('document');
    return valid.has(key) ? key : 'terms';
  };
  const show = (key, push, instant) => {
    docs.forEach(d => { d.hidden = d.dataset.doc !== key; });
    tabs.forEach(t => t.setAttribute('aria-current', t.dataset.tab === key ? 'page' : 'false'));
    const tab = tabs.find(t => t.dataset.tab === key);
    document.title = tab.textContent + ' — TrustForex';
    // On a phone the links scroll sideways; centre the open one so Cookie Settings is not off-screen.
    const a = tab.getBoundingClientRect(), r = row.getBoundingClientRect();
    row.scrollLeft += a.left + a.width / 2 - (r.left + r.width / 2);
    if (!push) return;
    const url = new URL(location.href);
    url.searchParams.set('document', key);
    url.hash = '';
    history.pushState({ document: key }, '', url);
    window.scrollTo({ top: 0, behavior: instant ? 'instant' : 'smooth' });
  };
  // The footer's legal column carries the same ?document= links; they switch in place too, and land
  // at the top at once, as every footer link does — a glide up a whole document stops wherever a touch catches it.
  document.querySelectorAll('a[href^="?document="]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    show(new URLSearchParams(a.getAttribute('href')).get('document'), true, !!a.closest('footer'));
  }));
  addEventListener('popstate', () => show(requested(), false));
  show(requested(), false);

  // The tab bar's white fills over the 72px of scroll after it sticks under the nav (page.css, --p), and
  // its text turns from white to navy at 40%. The stick point is where the bar's own top meets the nav:
  // the band's foot plus the bar's negative margin, measured, since the band's height follows the title.
  const bar = document.querySelector('.doc-tabs'), band = document.querySelector('.legal-top');
  if (bar && band) {
    let from = 0;
    const fill = () => {
      const p = Math.min(1, Math.max(0, (scrollY - from) / 72));
      bar.style.setProperty('--p', p.toFixed(3));
      bar.classList.toggle('is-clear', p < .4);
    };
    const measure = () => {
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'));
      from = band.getBoundingClientRect().bottom + scrollY + parseFloat(getComputedStyle(bar).marginTop) - navH;
      fill();
    };
    addEventListener('scroll', fill, { passive: true });
    addEventListener('resize', measure);
    measure();
  }

  // The house footer's pointer light, as cb8/main.js gives it on every other page (this page does not
  // load that file): --mx/--my on the pane, the CTA and each social icon, .lit while the pointer is over it.
  const foot = document.querySelector('.fsig');
  if (foot) {
    const lit = [foot, ...foot.querySelectorAll('.fsig-cta, .social a')];
    foot.addEventListener('pointermove', e => {
      for (const el of lit) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    }, { passive: true });
    foot.addEventListener('pointerenter', () => foot.classList.add('lit'));
    foot.addEventListener('pointerleave', () => foot.classList.remove('lit'));
    // and its top edge on a whole pixel, as cb8/main.js puts it on every other page (see the note there)
    const top = () => foot.getBoundingClientRect().top + scrollY;
    if ('ResizeObserver' in window) new ResizeObserver(() => {
      foot.style.marginTop = foot.style.paddingBottom = '';
      const y = top(), frac = y - Math.floor(y);
      if (frac < .01 || frac > .99) return;
      foot.style.marginTop = `calc(${getComputedStyle(foot).marginTop} + ${Math.ceil(y) - y}px)`;
      if (Math.abs(top() - Math.ceil(y)) < .01) return;
      foot.style.marginTop = '';
      foot.style.paddingBottom = `${frac}px`;
    }).observe(document.querySelector('main') || document.body);
  }
})();

/* ---------- footer social icons (.ico-social, cb8/ico/*.json): hover-only, no reveal
   play. This page has no main.js, so it plays them itself, same rest/hover logic. ---------- */
(() => {
  if (typeof lottie === 'undefined') return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.ico-social[data-lottie]').forEach(el => {
    const anim = lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, path: el.dataset.lottie });
    const rest = () => anim.goToAndStop(anim.totalFrames - 1, true);
    anim.addEventListener('DOMLoaded', rest);
    anim.addEventListener('complete', rest);
    (el.closest('a') || el).addEventListener('pointerenter', () => { if (!reduce && anim.isLoaded) anim.goToAndPlay(0, true); });
  });
})();
