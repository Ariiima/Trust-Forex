/* Partner Brokers — what this page adds beyond cb8/main.js.
   The hero is a picker: three partner tiles on one rail, the active one is the page's subject and every
   record below is that broker's. A broker shows only what it has: a figure it has no value for takes its
   row off the page, and a record it has nothing for (no licences, no rates, no bonus) is not shown at all.
   One broker is published (GTCFX); the other two carry their name and nothing else yet.

   The broker lives in the URL (?broker=xm), so a card is a link and the back button works. */
(() => {
  /* The broker table. GTCFX's record is the one the page ships in its HTML — the table is what the other
     brokers are measured against, and what the self-check reads the shipped markup back against. A field
     left out is a field the broker does not have. */
  const BROKERS = {
    gtcfx: {
      name: 'GTCFX',
      products: 'Forex and multi-asset CFDs',
      accounts: 'Standard and ECN',
      spread: 'From 0.0 pips',
      leverage: 'Up to 1:2000',
      cashback: 'Up to $2.40 / lot',
      platforms: 'MT4, MT5, and GTC Go',
      stdDeposit: 'No minimum', stdLeverage: 'Up to 1:2000', stdSpread: 'Average 1.0 pips',
      stdCommission: '$0', stdPlatforms: 'MT4, MT5, GTC Go',
      ecnDeposit: 'From $3,000', ecnLeverage: 'Up to 1:2000', ecnSpread: 'From 0.0 pips',
      ecnCommission: '$5 / standard lot', ecnPlatforms: 'MT4, MT5, GTC Go',
      regulation: [
        { code: 'FSCA', country: 'South Africa', entity: 'GTC Global SA (Pty) Ltd', licence: 'FSP 51545' },
        { code: 'VFSC', country: 'Vanuatu', entity: 'GTC Global Trade Capital Co. Limited', licence: '40354' },
        { code: 'FCA', country: 'United Kingdom', entity: 'Global Markets Group Limited*', licence: 'FRN 744501' },
        { code: 'ASIC', country: 'Australia', entity: 'GTC Global (Australia) Pty Ltd', licence: 'AFSL 496371' },
        { code: 'FSC', country: 'Mauritius', entity: 'GTC Global Ltd', licence: 'GB22200292' },
      ],
      /* a row is a market and its four figures, No plan to Diamond */
      rates: [
        { account: 'Standard Account', rows: [
          ['Gold - XAUUSD', '$0.80', '$1.20', '$1.60', '$2.40'],
          ['Forex', '$0.60', '$0.90', '$1.20', '$1.80'],
          ['Other markets', '$0.60', '$0.90', '$1.20', '$1.80'],
        ] },
        { account: 'ECN Account', rows: [
          ['Gold - XAUUSD', '$0.20', '$0.30', '$0.40', '$0.60'],
          ['Forex', '$0.10', '$0.15', '$0.20', '$0.30'],
          ['Other markets', '$0.10', '$0.15', '$0.20', '$0.30'],
        ] },
      ],
      bonuses: [
        { figure: '100%', title: 'Deposit Bonus', lines: [
          'Receive a 100% bonus on eligible deposits, up to the confirmed maximum.',
          'The offer is available to eligible users in supported regions.',
          'The bonus applies to the account types listed in the offer.',
          'Only deposits within the confirmed range qualify for the bonus.',
          'Activate the offer through the stated steps within its validity period.',
          "Trading and withdrawal follow the broker's published bonus conditions.",
        ] },
        { figure: '20%', title: 'Deposit Bonus', lines: [
          'Receive a 20% bonus on eligible deposits, up to the confirmed maximum.',
          'The offer is available to eligible users in supported regions.',
          'The bonus applies to the account types listed in the offer.',
          'Only deposits within the confirmed range qualify for the bonus.',
          'Activate the offer through the stated steps within its validity period.',
          "Trading and withdrawal follow the broker's published bonus conditions.",
        ] },
      ],
    },
    xm: { name: 'XM' },
    xs: { name: 'XS' },
  };

  /* which element takes which field */
  const BIND = {
    ovBroker: 'name', ovProducts: 'products', ovAccounts: 'accounts', ovSpread: 'spread',
    ovLeverage: 'leverage', ovCashback: 'cashback', ovPlatforms: 'platforms',
    stdDeposit: 'stdDeposit', stdLeverage: 'stdLeverage', stdSpread: 'stdSpread',
    stdCommission: 'stdCommission', stdPlatforms: 'stdPlatforms',
    ecnDeposit: 'ecnDeposit', ecnLeverage: 'ecnLeverage', ecnSpread: 'ecnSpread',
    ecnCommission: 'ecnCommission', ecnPlatforms: 'ecnPlatforms',
  };

  /* the three records drawn from a list, in the markup index.html ships for GTCFX */
  const rays = (k) => `<div class="rayfield k ${k}" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
  const PLANS = '<th scope="col">Symbol / Market</th><th scope="col">No Plan <b>10%</b></th><th scope="col">Silver <b>15%</b></th><th scope="col">Gold <b>20%</b></th><th scope="col">Diamond <b>30%</b></th>';
  const RECORDS = [
    { field: 'regulation', box: 'regGrid', draw: (list) =>
      `<div class="value-panel reg-panel" aria-label="Licences held">${rays('k02')}${list.map((l) =>
        `<article class="value-row reg-row"><span class="reg-code">${l.code}</span><div class="value-copy"><strong>${l.country}</strong><p>${l.entity}</p></div><span class="reg-lic">${l.licence}</span></article>`).join('')}</div>` },
    { field: 'rates', box: 'rateTables', draw: (list) => list.map((pane) =>
      `<div class="panel rate-pane"><div class="rate-head"><h3>${pane.account}</h3><span>Final cashback for 1 eligible standard lot</span></div>` +
      `<div class="rate-scroll"><table class="rate-table"><thead><tr>${PLANS}</tr></thead><tbody>${pane.rows.map(([market, ...figures]) =>
        `<tr><th scope="row">${market}</th>${figures.map((f) => `<td>${f}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('') },
    /* the two hues alternate, so a third offer takes the first one's */
    { field: 'bonuses', box: 'bonusGrid', draw: (list) => list.map((b, n) =>
      `<article class="value-panel bonus-card" data-bonus="${n % 2 ? 'b' : 'a'}">${rays(n % 2 ? 'k03' : 'k06')}` +
      `<div class="bonus-head"><span class="bonus-figure">${b.figure}</span><h3>${b.title}</h3></div>${b.lines.map((line, i) =>
        `<div class="value-row bonus-line"><span class="bonus-num">${i + 1}</span><p>${line}</p></div>`).join('')}</article>`).join('') },
  ];

  const cards = [...document.querySelectorAll('.broker-card')];
  const dots = [...document.querySelectorAll('.broker-dot')];
  const name = document.getElementById('h1');
  /* the markup as it ships, which the self-check holds GTCFX's drawn records to */
  const shipped = Object.fromEntries(RECORDS.map(({ box }) => [box, document.getElementById(box).innerHTML]));
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

    /* a figure the broker does not have takes its row with it; an account card left with no rows goes, and
       Account types goes once both have */
    Object.entries(BIND).forEach(([id, field]) => {
      const el = document.getElementById(id);
      el.textContent = data[field] ?? '';
      el.parentElement.hidden = data[field] == null;
    });
    document.querySelectorAll('.account-pane').forEach((pane) => { pane.hidden = !pane.querySelector('.account-row:not([hidden])'); });
    document.getElementById('accounts').hidden = !document.querySelector('.account-pane:not([hidden])');

    /* a record the broker has nothing for is not shown at all */
    RECORDS.forEach(({ field, box, draw }) => {
      const list = data[field];
      const el = document.getElementById(box);
      el.innerHTML = list?.length ? draw(list) : '';
      el.closest('section').hidden = !list?.length;
    });

    /* the side glows go left and right in turn over the records that are showing, not over all of them */
    [...document.querySelectorAll('.records > .screen.data:not([hidden])')]
      .forEach((s, n) => s.style.setProperty('--side', n % 2 ? '96%' : '4%'));
    document.title = `${data.name} Broker Details | TrustForex`;
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
     Two things. What shows is what the broker has: every row and record is on the page exactly when its
     data is, and GTCFX's records draw back the markup index.html ships. And the rate tables' arithmetic:
     every figure is the no-plan figure scaled by that plan's share (10 → 15 → 20 → 30), and the overview's
     "Maximum cashback" is the largest figure printed. Both in cents, against the page as it stands. */
  if (new URLSearchParams(location.search).get('check') === '1') {
    const fails = [];
    const cents = (s) => Math.round(parseFloat(String(s).replace(/[^0-9.]/g, '')) * 100);
    const shown = (el) => el.getClientRects().length > 0;

    Object.keys(BROKERS).forEach((key) => { if (indexOf(key) < 0) fails.push(`${key} is in the table with no card on the rail`); });
    cards.forEach((c) => { if (!BROKERS[c.dataset.broker]) fails.push(`the rail has a card for ${c.dataset.broker}, the table does not`); });
    if (dots.length !== cards.length) fails.push(`${dots.length} dots for ${cards.length} cards`);
    const lit = cards.filter((c) => c.classList.contains('is-active'));
    if (lit.length !== 1) fails.push(`${lit.length} cards are active, exactly 1 must be`);

    const showing = cards[active].dataset.broker;
    const data = BROKERS[showing];
    Object.entries(BIND).forEach(([id, field]) => {
      const el = document.getElementById(id);
      if (shown(el) !== (data[field] != null)) fails.push(`${showing} ${field}: ${data[field] == null ? 'has no value but its row shows' : 'has a value but its row is hidden'}`);
      else if (data[field] != null && el.textContent.trim() !== data[field]) fails.push(`${showing} ${field} reads "${el.textContent.trim()}", the table says "${data[field]}"`);
    });
    RECORDS.forEach(({ field, box }) => {
      const section = document.getElementById(box).closest('section');
      if (shown(section) !== Boolean(data[field]?.length)) fails.push(`${showing} ${section.dataset.name}: ${data[field]?.length ? 'has data but the record is hidden' : 'has no data but the record shows'}`);
      if (showing === 'gtcfx' && document.getElementById(box).innerHTML !== shipped[box].replace(/>\s+</g, '><').trim())
        fails.push(`GTCFX ${section.dataset.name}: the table draws different markup from what index.html ships`);
    });
    const visible = [...document.querySelectorAll('.records > .screen.data')].filter(shown);
    visible.forEach((s, n) => {
      if (getComputedStyle(s).getPropertyValue('--side').trim() !== (n % 2 ? '96%' : '4%')) fails.push(`${s.dataset.name}'s glow is on the same side as the record above it`);
    });

    /* a row is a market, a column is a plan. So the share arithmetic is read ACROSS a row — every plan pays
       its share of that market's no-plan figure — and each plan's share is read from its column head. The
       last column is the one page.css fills, so it has to be the top share. */
    const tables = [...document.querySelectorAll('#rateTables .rate-table')];
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
    if (tables.length && data.cashback != null) {
      const claimed = cents(data.cashback);
      if (claimed !== top) fails.push(`the overview claims ${claimed / 100} per lot, the tables top out at ${top / 100}`);
    }

    console.log(fails.length ? 'BROKERS CHECK FAIL\n' + fails.join('\n')
      : `BROKERS CHECK OK — ${cards.length} brokers, showing ${showing}: ${visible.map((s) => s.dataset.name).join(', ')}${tables.length ? `; ${top / 100} per lot at the top of ${tables.length} tables` : ''}`);
  }
})();
