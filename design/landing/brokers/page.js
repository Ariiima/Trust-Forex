/* Partner Brokers — what this page adds beyond cb8/main.js.
   The hero is a picker: three partner tiles on one rail, the active one is the page's subject and every
   record below is that broker's. One broker is published (GTCFX); the other two carry the same shape
   with their figures pending, and the three sections that are pure broker data (regulation, rates, bonuses)
   say so rather than showing someone else's numbers.

   The broker lives in the URL (?broker=xm), so a card is a link and the back button works. */
(() => {
  const PENDING = 'Data pending';
  const pending = (name) => ({
    name,
    products: PENDING, accounts: PENDING, spread: PENDING, leverage: PENDING, cashback: PENDING,
    platforms: PENDING, connection: PENDING,
    stdDeposit: PENDING, stdLeverage: PENDING, stdSpread: PENDING, stdCommission: PENDING, stdPlatforms: PENDING,
    ecnDeposit: PENDING, ecnLeverage: PENDING, ecnSpread: PENDING, ecnCommission: PENDING, ecnPlatforms: PENDING,
  });

  /* The published record. GTCFX's figures are the ones the page ships in its HTML — the table is what the
     other brokers are measured against, and what the self-check reads the shipped markup back against. */
  const BROKERS = {
    gtcfx: {
      name: 'GTCFX',
      products: 'Forex and multi-asset CFDs',
      accounts: 'Standard and ECN',
      spread: 'From 0.0 pips',
      leverage: 'Up to 1:2000',
      cashback: 'Up to $2.40 / lot',
      platforms: 'MT4, MT5, and GTC Go',
      connection: 'New accounts through TrustForex only',
      stdDeposit: 'No minimum', stdLeverage: 'Up to 1:2000', stdSpread: 'Average 1.0 pips',
      stdCommission: '$0', stdPlatforms: 'MT4, MT5, GTC Go',
      ecnDeposit: 'From $3,000', ecnLeverage: 'Up to 1:2000', ecnSpread: 'From 0.0 pips',
      ecnCommission: '$5 / standard lot', ecnPlatforms: 'MT4, MT5, GTC Go',
    },
    xm: pending('XM'),
    xs: pending('XS'),
  };

  /* which element takes which field */
  const BIND = {
    ovBroker: 'name', ovProducts: 'products', ovAccounts: 'accounts', ovSpread: 'spread',
    ovLeverage: 'leverage', ovCashback: 'cashback', ovPlatforms: 'platforms', ovConnection: 'connection',
    stdDeposit: 'stdDeposit', stdLeverage: 'stdLeverage', stdSpread: 'stdSpread',
    stdCommission: 'stdCommission', stdPlatforms: 'stdPlatforms',
    ecnDeposit: 'ecnDeposit', ecnLeverage: 'ecnLeverage', ecnSpread: 'ecnSpread',
    ecnCommission: 'ecnCommission', ecnPlatforms: 'ecnPlatforms',
  };

  const cards = [...document.querySelectorAll('.broker-card')];
  const dots = [...document.querySelectorAll('.broker-dot')];
  const name = document.getElementById('h1');
  /* the published sections, kept as they ship so returning to GTCFX restores the real markup */
  const SECTIONS = { regGrid: 'Regulation', rateTables: 'Cashback rates', bonusGrid: 'Bonus offers' };
  const published = Object.fromEntries(Object.keys(SECTIONS).map((id) => [id, document.getElementById(id).innerHTML]));
  if (!cards.length) return;

  let active = 0;

  const rail = () => {
    cards.forEach((card, n) => {
      const step = (n - active + cards.length) % cards.length;
      card.classList.remove('is-active', 'is-prev', 'is-next', 'is-far');
      card.classList.add(step === 0 ? 'is-active' : step === 1 ? 'is-next' : step === cards.length - 1 ? 'is-prev' : 'is-far');
      if (step === 0) card.setAttribute('aria-current', 'page'); else card.removeAttribute('aria-current');
    });
    dots.forEach((dot, n) => dot.setAttribute('aria-current', String(n === active)));
  };

  const paint = () => {
    const key = cards[active].dataset.broker;
    const data = BROKERS[key];
    name.textContent = data.name;
    Object.entries(BIND).forEach(([id, field]) => { document.getElementById(id).textContent = data[field]; });

    /* the three broker-data sections: the published markup, or one line saying whose record is still coming */
    Object.entries(SECTIONS).forEach(([id, what]) => {
      document.getElementById(id).innerHTML = key === 'gtcfx' ? published[id]
        : `<div class="placeholder">${what} for ${data.name} will be published here.</div>`;
    });
    document.title = `${data.name} — Partner Broker — TrustForex`;
  };

  const render = (i, push = true) => {
    active = (i + cards.length) % cards.length;
    rail();
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set('broker', cards[active].dataset.broker);
      history.pushState({ broker: cards[active].dataset.broker }, '', url);
    }
    paint();
  };

  const indexOf = (key) => cards.findIndex((c) => c.dataset.broker === key);
  const requested = () => new URLSearchParams(location.search).get('broker');

  document.querySelector('.carousel-arrow.prev').addEventListener('click', () => render(active - 1));
  document.querySelector('.carousel-arrow.next').addEventListener('click', () => render(active + 1));
  cards.forEach((card) => card.addEventListener('click', (e) => { e.preventDefault(); render(+card.dataset.index); }));
  dots.forEach((dot) => dot.addEventListener('click', () => render(+dot.dataset.index)));
  document.getElementById('stage').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    render(active + (e.key === 'ArrowRight' ? 1 : -1));
  });
  addEventListener('popstate', () => {
    const i = indexOf(requested());
    render(i >= 0 ? i : 0, false);
  });

  /* the shipped broker: the URL first, otherwise the card the HTML marks active */
  const start = indexOf(requested());
  render(start >= 0 ? start : 0, false);

  /* ---------- self-check: ?check=1 ----------
     The rate tables are the page's one piece of arithmetic: every figure is the no-plan figure scaled by that
     plan's share (10 → 15 → 20 → 30), and the overview's "Maximum cashback" is the largest figure printed.
     Both are checked in cents, against the markup as it ships. */
  if (new URLSearchParams(location.search).get('check') === '1') {
    const fails = [];
    const cents = (s) => Math.round(parseFloat(String(s).replace(/[^0-9.]/g, '')) * 100);

    Object.entries(BROKERS).forEach(([key, data]) => {
      if (indexOf(key) < 0) fails.push(`${key} is in the table with no card on the rail`);
      Object.values(BIND).forEach((field) => { if (data[field] == null) fails.push(`${key} has no ${field}`); });
    });
    cards.forEach((c) => { if (!BROKERS[c.dataset.broker]) fails.push(`the rail has a card for ${c.dataset.broker}, the table does not`); });
    if (dots.length !== cards.length) fails.push(`${dots.length} dots for ${cards.length} cards`);
    const lit = cards.filter((c) => c.classList.contains('is-active'));
    if (lit.length !== 1) fails.push(`${lit.length} cards are active, exactly 1 must be`);

    /* the arithmetic below is the published record's. A broker whose record is still coming carries the
       placeholder in all three data sections instead, and must not be left showing the last broker's figures. */
    const showing = cards[active].dataset.broker;
    const tables = [...document.querySelectorAll('#rateTables .rate-table')];
    if (showing !== 'gtcfx') {
      Object.entries(SECTIONS).forEach(([id, what]) => {
        if (!document.querySelector(`#${id} .placeholder`)) fails.push(`${showing} shows ${what} where its record is not published`);
      });
      if (document.getElementById('ovCashback').textContent.trim() !== BROKERS[showing].cashback)
        fails.push(`${showing} overview reads "${document.getElementById('ovCashback').textContent.trim()}", the table says "${BROKERS[showing].cashback}"`);
    } else if (!tables.length) {
      fails.push('the published broker is showing no rate table');
    }

    /* a row is a market, a column is a plan. So the share arithmetic is read ACROSS a row — every plan pays
       its share of that market's no-plan figure — and each plan's share is read from its column head. The
       last column is the one page.css fills, so it has to be the top share. */
    let top = 0;
    tables.forEach((table) => {
      const where = table.closest('.rate-pane').querySelector('.rate-head h3').textContent.trim();
      const shares = [...table.querySelectorAll('thead th b')].map((b) => parseInt(b.textContent, 10));
      if (shares.join() !== '10,15,20,30') fails.push(`${where}: the plan shares read ${shares.join('/')}, not 10/15/20/30`);
      [...table.querySelectorAll('tbody tr')].forEach((row) => {
        const market = row.querySelector('th').textContent.trim();
        const figures = [...row.querySelectorAll('td')].map((td) => cents(td.textContent));
        figures.forEach((c) => { if (c > top) top = c; });
        if (figures.length !== shares.length) return fails.push(`${where} / ${market}: ${figures.length} figures for ${shares.length} plans`);
        shares.forEach((share, n) => {
          const want = Math.round(figures[0] * share / shares[0]);
          if (figures[n] !== want) fails.push(`${where} / ${market}: ${share}% pays ${figures[n] / 100}, ${share / shares[0]}× the no-plan figure is ${want / 100}`);
        });
      });
    });
    if (tables.length) {
      const claimed = cents(document.getElementById('ovCashback').textContent);
      if (claimed !== top) fails.push(`the overview claims ${claimed / 100} per lot, the tables top out at ${top / 100}`);    }

    console.log(fails.length ? 'BROKERS CHECK FAIL\n' + fails.join('\n')
      : `BROKERS CHECK OK — ${cards.length} brokers, showing ${showing}, ${tables.length ? `${top / 100} per lot at the top of ${tables.length} tables` : 'its record pending'}`);
  }
})();
