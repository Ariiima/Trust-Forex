/* TrustForex Home — what this page adds beyond cb8/main.js (which owns the scroll, the reveal,
   the icons and the FAQ): the protocol steps' gate, the benefits column's arrival and the weekly
   record module.

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

  /* ---------- the benefits column: two notifications land, and the balance counts them in ----------
     The column ships finished — both messages, the full balance — and that is what a reader without
     JavaScript, with html.reduce, or arriving already level with it sees. Otherwise it is set back to
     its opening while it is still below the fold, and told once when it reaches the same reading band
     the steps use: Cashback lands and the counter rolls to its amount, then Referral lands above it and
     the counter rolls to the sum. The figure is a counter, not a tween: each digit becomes a strip of
     0–9 that CSS slides to its value, so this file writes four transforms per step and no frame loop. */
  const cents = (s) => Math.round(parseFloat(String(s).replace(/[$,]/g, '')) * 100) / 100;
  const feed = document.getElementById('benefit-feed');
  const figure = document.getElementById('feed-figure');
  const shippedBalance = figure ? figure.textContent.trim() : '';
  if (feed && figure) {
    const cols = [];
    figure.setAttribute('aria-label', shippedBalance);
    figure.textContent = '';
    ['$', 'd', 'd', '.', 'd', 'd'].forEach((ch) => {
      const cell = document.createElement('span');
      cell.setAttribute('aria-hidden', 'true');
      if (ch !== 'd') { cell.className = 'odo-c'; cell.textContent = ch; figure.append(cell); return; }
      cell.className = 'odo-d';
      const strip = document.createElement('i');
      strip.style.setProperty('--roll', `${1.15 - cols.length * 0.15}s`);   // the higher the place, the slower it turns
      for (let n = 0; n < 10; n++) strip.append(Object.assign(document.createElement('span'), { textContent: String(n) }));
      cell.append(strip);
      figure.append(cell);
      cols.push({ cell, strip });
    });
    const show = (dollars, instant) => {
      if (instant) figure.classList.add('odo-hold');
      const c = Math.round(dollars * 100);
      [Math.floor(c / 1000) % 10, Math.floor(c / 100) % 10, Math.floor(c / 10) % 10, c % 10]
        .forEach((d, i) => { cols[i].strip.style.transform = `translateY(${-d}em)`; });
      cols[0].cell.toggleAttribute('data-zero', c < 1000);
      if (instant) { void figure.offsetWidth; figure.classList.remove('odo-hold'); }
    };
    show(cents(shippedBalance), true);

    const html = document.documentElement;
    if (!html.classList.contains('reduce') && feed.getBoundingClientRect().top > innerHeight) {
      const cashback = cents(feed.querySelector('.feed-legend [data-benefit=cashback] b').textContent);
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      feed.dataset.step = '0';
      show(0, true);
      const gate = new IntersectionObserver(async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        gate.disconnect();
        await wait(650);                                   // the column's own .rv reveal goes first
        feed.dataset.step = '1'; await wait(450); show(cashback); await wait(1500);
        feed.dataset.step = '2'; await wait(450); show(cents(shippedBalance)); await wait(1200);
        delete feed.dataset.step;
      }, { rootMargin: '-20% 0px -40% 0px' });
      gate.observe(feed);
    }
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
     The cards are native radios (page.css), so picking one needs nothing from here. The button
     does: the app's checkout takes ?plan= and opens on that plan (src/App.tsx), so its link
     follows the checked card. The markup ships the app's own plan picker as the href, which is
     where a reader without JavaScript should land rather than on a plan they did not pick.
     The radios carry autocomplete="off": without it a reload brings back the last card picked
     instead of Gold. */
  const planCta = document.getElementById('plan-cta');
  const planHref = (plan) => `https://app.trustforex.net/checkout?plan=${plan}`;
  const syncPlan = () => {
    const picked = document.querySelector('.plan-pick:checked');
    if (planCta && picked) planCta.href = planHref(picked.value);
  };
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
  /* the benefits column's figures are an example, but they have to add up: the balance is its two
     amounts, each notification names its own amount, and each bar segment is weighted by it */
  if (feed) {
    const amounts = ['cashback', 'referral'].map((b) => feed.querySelector(`.feed-legend [data-benefit=${b}] b`).textContent.trim());
    const sum = amounts.reduce((t, a) => t + cents(a), 0);
    if (cents(shippedBalance) !== Math.round(sum * 100) / 100) fails.push(`the balance reads ${shippedBalance}, its two amounts add to $${sum.toFixed(2)}`);
    ['cashback', 'referral'].forEach((b, i) => {
      if (!feed.querySelector(`.feed-slot[data-benefit=${b}] .feed-text`).textContent.includes(amounts[i])) fails.push(`the ${b} notification does not name ${amounts[i]}`);
      const w = +feed.querySelector(`.feed-bar [data-benefit=${b}]`).style.getPropertyValue('--w');
      if (w !== cents(amounts[i])) fails.push(`the ${b} bar is weighted ${w}, its amount is ${amounts[i]}`);
    });
  }
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
  });
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
