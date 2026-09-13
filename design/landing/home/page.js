/* TrustForex Home — what this page adds beyond cb8/main.js (which owns the scroll, the reveal,
   the icons and the FAQ): the protocol steps' gate, the weekly record module and the plans' pick.

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

  /* ---------- the plans: the button under the cards follows the pick ----------
     The cards are native radios (page.css), so picking one, and its motion, needs nothing from
     here. The button does: the app's checkout takes ?plan= and opens on that plan (src/App.tsx),
     so its link follows the checked card, and it names that card ("Continue with Gold") and takes
     its data-tier, which cb8's tier system turns into the ink page.css draws its rim in. The
     markup ships the app's own plan picker as the href and "Choose Your Plan in the App" as the
     words, which is where a reader without JavaScript should land rather than on a plan they did
     not pick. A pick (not the first sync) restarts .swap: the words lift in, a ring leaves the rim.
     The radios carry autocomplete="off": without it a reload brings back the last card picked
     instead of Gold. */
  const planCta = document.getElementById('plan-cta');
  const planLabel = planCta && planCta.querySelector('.plan-cta-label');
  const planHref = (plan) => `https://app.trustforex.net/checkout?plan=${plan}`;
  const planWords = (plan) => `Continue with ${document.getElementById(`plan-${plan}`).textContent.trim()}`;
  const syncPlan = (e) => {
    const picked = document.querySelector('.plan-pick:checked');
    if (!planCta || !picked) return;
    planCta.href = planHref(picked.value);
    planCta.dataset.tier = picked.value;
    if (planLabel) planLabel.textContent = planWords(picked.value);
    if (e) { planCta.classList.remove('swap'); void planCta.offsetWidth; planCta.classList.add('swap'); countSave(picked.closest('.plan-col')); }
  };
  /* The saving counts up from $0 to its figure each time its card is picked (founder, 2026-09-13).
     A short frame loop on the one span, easing out so the last dollars land slowly. The markup keeps
     the finished figure, which is what a reader without JavaScript, with html.reduce, or on Gold's
     opening pick sees; a card left mid-count snaps to its figure. Not the calculator's rule
     (cb8/base.css: "cross-fade, never a count-up"): that estimate changes as you type, this is one
     fixed figure arriving on a pick. */
  const saveAt = (text, p) => text.replace(/\$([\d,]+)/, (_, n) => `$${Math.round(+n.replace(/,/g, '') * p).toLocaleString('en-US')}`);
  let saving = null;                          // the count in flight: its span, its figure, its frame
  function countSave(col) {
    if (saving) { cancelAnimationFrame(saving.frame); saving.el.textContent = saving.to; saving = null; }
    const el = col.querySelector('.plan-save');
    if (!el || document.documentElement.classList.contains('reduce')) return;
    const run = saving = { el, to: el.textContent, frame: 0 };
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / 900));
      el.textContent = saveAt(run.to, 1 - (1 - t) ** 3);
      if (t < 1) run.frame = requestAnimationFrame(tick); else saving = null;
    };
    el.textContent = saveAt(run.to, 0);
    run.frame = requestAnimationFrame(tick);
  }
  /* each character of the share gets a cell with its place in --n, so page.css can spring them up one
     after another on a pick; the figure keeps its words for a screen reader in an aria-label, and its
     textContent stays "30%" for the self-check */
  document.querySelectorAll('.plan-rate b').forEach((b) => {
    const text = b.textContent.trim();
    b.setAttribute('aria-label', text);
    b.replaceChildren(...[...text].map((ch, n) => {
      const cell = document.createElement('i');
      cell.setAttribute('aria-hidden', 'true');
      cell.style.setProperty('--n', n);
      cell.textContent = ch;
      return cell;
    }));
  });
  document.querySelectorAll('.plan-pick').forEach((r) => r.addEventListener('change', syncPlan));
  syncPlan();

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
  // a rate on the pricing block or the benefits' strip must be the rate the app pays on that plan
  // (src/screens/plans/plans-data.ts); Standard is no plan at all (server/ledger.mjs TIER_PCT.none)
  const SHARE = { standard: '10%', silver: '15%', gold: '20%', diamond: '30%' };
  document.querySelectorAll('.plan-col').forEach((col) => {
    const shown = col.querySelector('.plan-rate b').textContent.trim();
    if (SHARE[col.dataset.tier] !== shown) fails.push(`the ${col.dataset.tier} plan shows ${shown}, the app pays ${SHARE[col.dataset.tier]}`);
  });
  const points = [...document.querySelectorAll('.rate-points li')];
  const tiers = points.map((li) => li.dataset.tier).join(', ');
  if (tiers !== Object.keys(SHARE).join(', ')) fails.push(`the rate strip lists ${tiers}, the app has ${Object.keys(SHARE).join(', ')}`);
  points.forEach((li) => {
    const shown = li.querySelector('b').textContent.trim();
    if (SHARE[li.dataset.tier] !== shown) fails.push(`the rate strip shows ${li.dataset.tier} at ${shown}, the app pays ${SHARE[li.dataset.tier]}`);
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
    // a longer term saves the monthly plan's price times its months, less its own price
    const save = col.querySelector('.plan-save');
    const saved = `Save $${(+EQUIV[0][0].slice(1) * months - +price.replace(/[$,]/g, '')).toLocaleString('en-US')}`;
    if (months > 1 && (!save || save.textContent.trim() !== saved)) fails.push(`plan ${i + 1} says ${save ? save.textContent.trim() : 'no saving'}, expected ${saved}`);
  });
  // the count a pick plays starts at $0, keeps the words and the thousands comma, and lands on the figure
  const frames = [0, 0.5, 1].map((p) => saveAt('Save $1,701', p)).join(' · ');
  if (frames !== 'Save $0 · Save $851 · Save $1,701') fails.push(`the saving counts ${frames}`);
  // the plans open on Gold, and picking each card points the button at that card's checkout
  const picks = [...document.querySelectorAll('.plan-pick')];
  const opening = picks.find((r) => r.checked);
  if (!opening || opening.value !== 'gold') fails.push(`the plans open with ${opening ? opening.value : 'nothing'} picked, not gold`);
  picks.filter((r) => r.getAttribute('autocomplete') !== 'off').forEach((r) => fails.push(`the ${r.value} radio lets a reload restore the last pick over gold`));
  if (!planCta) fails.push('the plans have no button to carry the pick');
  else picks.forEach((r) => {
    const tier = r.closest('.plan-col').dataset.tier;
    if (r.value !== tier) fails.push(`the ${tier} card picks ${r.value}`);
    r.click();
    if (planCta.getAttribute('href') !== planHref(tier)) fails.push(`picking ${tier} leaves the button on ${planCta.getAttribute('href')}`);
    if (planCta.dataset.tier !== tier) fails.push(`picking ${tier} leaves the button in ${planCta.dataset.tier} ink`);
    if (!planLabel || planLabel.textContent !== planWords(tier)) fails.push(`picking ${tier} leaves the button saying ${planLabel ? planLabel.textContent : 'nothing'}`);
  });
  if (opening) opening.click();

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
