/* TrustForex Home — what this page adds beyond cb8/main.js (which owns the scroll, the reveal,
   the icons and the FAQ): the weekly record module.

   The module shows the last completed week of the Results page's signal series. It is not typed
   into the HTML twice: the rule below is results/page.js's own — the same base win rates, the same
   per-period shift, the same rounding — so the two pages can only ever print the same figures.
   The HTML still ships the computed values, so the module reads correctly before this file runs
   and without JavaScript at all; ?check=1 proves the shipped markup equals what the rule returns,
   and that the constants still match the Results page it borrowed them from. */
(() => {
  /* ---------- the four protocol steps arrive when they are read, not when they intersect ----------
     cb8/main.js reveals a screen at threshold .25 of the screen itself, which is right for a screen
     whose content fills it and wrong for these four, where one word sits in the middle of 100dvh of
     ground. Measured: when .in lands on step-1 the word's top edge is 137px BELOW the fold — the
     clamp then spends its whole 880ms off screen and is long finished by the time the word rises
     into view, so nobody ever sees it move.

     So the steps get their own gate, gated on the word rather than on the screen: the title has to
     reach the middle band of the viewport before the class goes on. The band is the root inset by
     20% at the top and 40% at the bottom, so the arrival starts with the word about three fifths
     down the screen and plays while it rises to reading position. Once, never removed, like .in.
     page.css hangs both the word and its sentence off this, so the sentence cannot land a screen
     ahead of the word it belongs to. */
  const steps = [...document.querySelectorAll('.step')];
  if (steps.length) {
    const gate = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.closest('.step').classList.add('step-here');
        gate.unobserve(e.target);
      });
    }, { rootMargin: '-20% 0px -40% 0px' });
    steps.forEach((s) => { const title = s.querySelector('.step-title'); if (title) gate.observe(title); });
  }

  /* ---------- the Results page's weekly series (results/page.js) ---------- */
  const BASE = { tp1: 84, tp2: 68, tp3: 49, tp4: 31 };
  const TARGETS = ['tp1', 'tp2', 'tp3', 'tp4'];
  const LAST_PERIOD = '26 Aug 2026';          // the last entry of that page's weeklyDates
  const LAST_INDEX = 29;                      // its position, which is also its seed
  const total = (i) => (i === 12 ? 0 : 6 + (i % 8));
  const rateFor = (target, index, signals) => {
    if (!signals) return null;
    const shift = Math.sin((index + index * 0.17) * 1.1) * 9 + Math.cos(index * 0.48) * 4;
    const estimated = Math.max(3, Math.min(96, Math.round(BASE[target] + shift)));
    const hits = Math.min(signals, Math.round(signals * estimated / 100));
    return Math.round(hits / signals * 100);
  };

  const signals = total(LAST_INDEX);
  const rates = TARGETS.map((t) => rateFor(t, LAST_INDEX, signals));

  /* ---------- paint it ---------- */
  const bars = [...document.querySelectorAll('#weekly-bars .weekly-bar')];
  const period = document.getElementById('week-period');
  const count = document.getElementById('week-total');
  const chart = document.getElementById('weekly-chart');
  if (bars.length === TARGETS.length && period && count) {
    period.textContent = `Week ending ${LAST_PERIOD}`;
    count.textContent = String(signals);
    bars.forEach((bar, i) => {
      bar.style.setProperty('--rate', `${rates[i]}%`);
      bar.querySelector('b').textContent = `${rates[i]}%`;
      bar.querySelector('span').textContent = TARGETS[i].toUpperCase();
    });
    chart.setAttribute('aria-label',
      'Weekly target win rates: ' + TARGETS.map((t, i) => `${t.toUpperCase()} ${rates[i]} percent`).join(', '));
  }

  /* ---------- self-check ---------- */
  if (new URLSearchParams(location.search).get('check') !== '1') return;
  const fails = [];
  if (signals !== 11) fails.push(`the last completed week holds ${signals} signals, the series says 11`);
  rates.forEach((r, i) => {
    if (!(r >= 0 && r <= 100)) fails.push(`${TARGETS[i]} win rate ${r} is outside 0–100`);
  });
  for (let i = 1; i < rates.length; i++) {
    if (rates[i] > rates[i - 1]) fails.push(`${TARGETS[i]} (${rates[i]}%) beats ${TARGETS[i - 1]} (${rates[i - 1]}%) — a further target cannot be reached more often`);
  }
  bars.forEach((bar, i) => {
    const printed = bar.querySelector('b').textContent.trim();
    if (printed !== `${rates[i]}%`) fails.push(`${TARGETS[i]} bar prints ${printed}, the rule says ${rates[i]}%`);
  });
  const rails = [...document.querySelectorAll('.rate-point')];
  if (rails.length !== 4) fails.push(`${rails.length} shared-rate points, exactly 4 must be`);
  const SHARE = { standard: '10%', silver: '15%', gold: '20%', diamond: '30%' };
  rails.forEach((p) => {
    const shown = p.querySelector('b').textContent.trim();
    if (SHARE[p.dataset.tier] !== shown) fails.push(`the ${p.dataset.tier} point shows ${shown}, the plan pays ${SHARE[p.dataset.tier]}`);
  });
  // a plan's rate on the pricing block must be the same rate the benefits section promised
  document.querySelectorAll('.plan-col').forEach((col) => {
    const shown = col.querySelector('.plan-rate b').textContent.trim();
    if (SHARE[col.dataset.tier] !== shown) fails.push(`the ${col.dataset.tier} plan shows ${shown}, the shared rate is ${SHARE[col.dataset.tier]}`);
  });
  // the monthly equivalents must divide out of the prices the app charges
  const EQUIV = [['$200', 1, '$200'], ['$499', 3, '≈ $166'], ['$1,699', 12, '≈ $142']];
  [...document.querySelectorAll('.plan-col')].forEach((col, i) => {
    const [price, months, equiv] = EQUIV[i];
    if (col.querySelector('.price').textContent.trim() !== price) fails.push(`plan ${i + 1} price is ${col.querySelector('.price').textContent.trim()}, expected ${price}`);
    const n = Math.round(+price.replace(/[$,]/g, '') / months);
    const want = months === 1 ? `$${n}` : `≈ $${n}`;
    if (want !== equiv) fails.push(`plan ${i + 1} monthly equivalent ${equiv} is not ${want}`);
    if (!col.querySelector('.equiv').textContent.includes(equiv)) fails.push(`plan ${i + 1} does not print ${equiv}`);
  });

  /* the constants above are borrowed; if the Results page moves them, this page is lying. One
     fetch of that file, two assertions — cheaper than two pages drifting apart unnoticed. */
  fetch('../results/page.js').then((r) => (r.ok ? r.text() : '')).then((src) => {
    if (!src) { fails.push('could not read ../results/page.js to check for drift'); return; }
    const base = src.match(/const base = \{([^}]*)\}/);
    const want = TARGETS.map((t) => `${t}: ${BASE[t]}`).join(', ');
    if (!base || base[1].trim() !== want) fails.push(`Results now bases its rates on {${base ? base[1].trim() : '?'}}, this page assumes {${want}}`);
    if (!src.includes(`'${LAST_PERIOD}'`)) fails.push(`Results no longer carries the week ${LAST_PERIOD}; the record module is stale`);
  }).finally(() => {
    console.log(fails.length
      ? 'HOME CHECK FAIL\n' + fails.join('\n')
      : `HOME CHECK OK — week ending ${LAST_PERIOD}, ${signals} signals, ${rates.map((r, i) => TARGETS[i].toUpperCase() + ' ' + r + '%').join(' · ')}`);
  });
})();
