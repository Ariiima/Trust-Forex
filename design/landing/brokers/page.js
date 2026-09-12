/* Partner Brokers — what this page adds beyond cb8/main.js.
   The hero is a picker: three partner cards on one rail, the active one's name is the page's statement and
   every record below is that broker's. One broker is published (GTCFX); the other two carry the same shape
   with their figures pending, and the three sections that are pure broker data (regulation, rates, bonuses)
   say so rather than showing someone else's numbers.

   The broker lives in the URL (?broker=xm), so a card is a link and the back button works. */
(() => {
  const PENDING = 'Data pending';
  /* The fact strip carries the broker's own headline figures where there are any. A broker whose record is
     still coming falls back to these four — what is true of every partner broker — rather than looping four
     ways of saying "not yet" under its name. */
  const SHARED_FACTS = ['Accounts opened through TrustForex', 'Cashback on every eligible lot',
                        'Credited every week', 'Your plan sets your share'];
  const pending = (name) => ({
    name, lede: 'Partner broker. The account, regulation and cashback record for this broker is in preparation.',
    products: PENDING, accounts: PENDING, spread: PENDING, leverage: PENDING, cashback: PENDING,
    platforms: PENDING, connection: PENDING,
    facts: SHARED_FACTS,
    stdDeposit: PENDING, stdLeverage: PENDING, stdSpread: PENDING, stdCommission: PENDING, stdPlatforms: PENDING,
    ecnDeposit: PENDING, ecnLeverage: PENDING, ecnSpread: PENDING, ecnCommission: PENDING, ecnPlatforms: PENDING,
  });

  /* The published record. GTCFX's figures are the ones the page ships in its HTML — the table is what the
     other brokers are measured against, and what the self-check reads the shipped markup back against. */
  const BROKERS = {
    gtcfx: {
      name: 'GTCFX',
      lede: 'Forex and multi-asset CFDs, with cashback on every eligible lot you close.',
      products: 'Forex and multi-asset CFDs',
      accounts: 'Standard and ECN',
      spread: 'From 0.0 pips',
      leverage: 'Up to 1:2000',
      cashback: 'Up to $2.40 / lot',
      platforms: 'MT4, MT5, and GTC Go',
      connection: 'New accounts through TrustForex only',
      facts: ['Standard and ECN accounts', 'Spreads from 0.0 pips', 'Leverage up to 1:2000', 'Cashback up to $2.40 per lot'],
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
  const lede = document.getElementById('brokerLede');
  /* the strip is the system's: a four-column row, one screen wide, three copies of it (cb8/style.css) */
  const FACTS = 4;
  const facts = [...document.querySelectorAll('.facts')];
  /* the published sections, kept as they ship so returning to GTCFX restores the real markup */
  const SECTIONS = { regGrid: 'Regulation', rateTables: 'Cashback rates', bonusGrid: 'Bonus offers' };
  const published = Object.fromEntries(Object.keys(SECTIONS).map((id) => [id, document.getElementById(id).innerHTML]));
  if (!cards.length) return;

  /* main.js splits a .words heading into one <span class="w"><i>word</i></span> per word and the gradient is
     clipped on those <i>; a heading rewritten here has to carry the same boxes or it loses its run. */
  const words = (el, text) => {
    el.innerHTML = text.trim().split(/\s+/).filter(Boolean)
      .map((w, i) => `<span class="w" style="--i:${i}"><i>${w}</i></span>`).join(' ');
  };
  let active = 0;

  /* The rail answers the click on the frame it happens: the cards slide, the dot moves. Only the words
     those cards name are held back — they fade down, change while nothing is legible, and come back
     (page.css owns the fade; --swap-ms is how long half of it takes). Swapping the text under the
     pointer instead, as the first build did, read as a flicker in the middle of a moving rail. */
  const hero = document.getElementById('hero');
  const REDUCE = document.documentElement.classList.contains('reduce');
  const SWAP_MS = REDUCE ? 0 : parseFloat(getComputedStyle(hero).getPropertyValue('--swap-out')) || 0;
  let swapTimer = 0;
  let painted = null;   // the broker whose words are on the page right now, which is not always the active card
  /* two brokers with no record of their own share the strip's four facts. Nothing changes there, so nothing
     fades there: the strip is left alone and keeps scrolling through the swap. */
  const sameFacts = (a, b) => !!a && !!b && BROKERS[a].facts.join(' ') === BROKERS[b].facts.join(' ');

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
    words(name, data.name);
    lede.textContent = data.lede;
    Object.entries(BIND).forEach(([id, field]) => { document.getElementById(id).textContent = data[field]; });
    /* --i is the column: the four cells come back one after another, left to right */
    if (!sameFacts(key, painted)) facts.forEach((list) => { list.innerHTML = data.facts.map((f, i) => `<li style="--i:${i}">${f}</li>`).join(''); });

    /* the three broker-data sections: the published markup, or one line saying whose record is still coming */
    Object.entries(SECTIONS).forEach(([id, what]) => {
      document.getElementById(id).innerHTML = key === 'gtcfx' ? published[id]
        : `<div class="placeholder">${what} for ${data.name} will be published here.</div>`;
    });
    document.title = `${data.name} — Partner Broker — TrustForex`;
    painted = key;
  };

  const render = (i, push = true) => {
    active = (i + cards.length) % cards.length;
    rail();
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set('broker', cards[active].dataset.broker);
      history.pushState({ broker: cards[active].dataset.broker }, '', url);
    }
    if (!SWAP_MS || !hero.classList.contains('is-live')) { paint(); return; }   // first paint and reduced motion: at once
    hero.classList.toggle('facts-change', !sameFacts(cards[active].dataset.broker, painted));
    hero.classList.add('is-swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {   // a second click before this fires simply moves the landing
      paint();
      hero.classList.remove('is-swapping');
    }, SWAP_MS);
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

  /* ---------- the rail says which record each dot is ----------
     This page used to carry a sticky strip of six anchors as well, which put a second bar under the
     fixed nav over every record. The rail was already there and already tracked the same sections, so
     it does the naming too: main.js builds one dot per .screen in document order, and each screen
     carries the name on data-name. page.css draws the label off data-label on hover, focus and the
     current dot. main.js owns aria-current, so nothing here has to observe the scroll. */
  const named = [...document.querySelectorAll('#deck .screen')];
  [...document.querySelectorAll('#rail .dot')].forEach((dot, i) => {
    const label = named[i] && named[i].dataset.name;
    if (label) dot.dataset.label = label;
  });

  /* the shipped broker: the URL first, otherwise the card the HTML marks active. This one paints at once
     — .is-live is what tells every later change to fade instead. */
  const start = indexOf(requested());
  render(start >= 0 ? start : 0, false);
  hero.classList.add('is-live');

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
      if (data.facts.length !== FACTS) fails.push(`${key} has ${data.facts.length} facts, the strip is ${FACTS} columns wide`);
    });
    cards.forEach((c) => { if (!BROKERS[c.dataset.broker]) fails.push(`the rail has a card for ${c.dataset.broker}, the table does not`); });
    if (facts.length !== 3) fails.push(`the strip carries ${facts.length} copies of its row, the loop needs 3`);
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

    /* the table is on its side now: a row is a plan, a column is a market. So the share arithmetic is read
       DOWN a column — every plan pays its share of the no-plan figure for that market — and the plan names
       its own row through data-tier, which is what carries the row's metal. */
    let top = 0;
    tables.forEach((table) => {
      const where = table.closest('.rate-pane').querySelector('.rate-head h3').textContent.trim();
      const markets = [...table.querySelectorAll('thead th')].slice(1).map((th) => th.textContent.trim());
      const rows = [...table.querySelectorAll('tbody tr')];
      const shares = rows.map((r) => parseInt(r.querySelector('.tier b').textContent, 10));
      if (shares.join() !== '10,15,20,30') fails.push(`${where}: the plan shares read ${shares.join('/')}, not 10/15/20/30`);
      if (rows.some((r) => !r.dataset.tier)) fails.push(`${where}: a plan row carries no data-tier, so it loses its metal`);
      const grid = rows.map((r) => [...r.querySelectorAll('td')].map((td) => cents(td.textContent)));
      grid.flat().forEach((c) => { if (c > top) top = c; });
      if (grid.some((r) => r.length !== markets.length))
        return fails.push(`${where}: a plan row carries ${grid.find((r) => r.length !== markets.length).length} figures for ${markets.length} markets`);
      markets.forEach((market, col) => {
        shares.forEach((share, n) => {
          const want = Math.round(grid[0][col] * share / shares[0]);
          if (grid[n][col] !== want) fails.push(`${where} / ${market}: ${share}% pays ${grid[n][col] / 100}, ${share / shares[0]}× the no-plan figure is ${want / 100}`);
        });
      });
    });
    if (tables.length) {
      const claimed = cents(document.getElementById('ovCashback').textContent);
      if (claimed !== top) fails.push(`the overview claims ${claimed / 100} per lot, the tables top out at ${top / 100}`);
    }
    /* the rail is the page's only wayfinding now, so every dot must know what it points at */
    const rails = [...document.querySelectorAll('#rail .dot')];
    if (rails.length && rails.length !== named.length) fails.push(`${rails.length} rail dots for ${named.length} screens`);
    named.forEach((el, i) => {
      if (!el.dataset.name) fails.push(`#${el.id || i} has no data-name, so its rail dot cannot be labelled`);
      else if (rails[i] && rails[i].dataset.label !== el.dataset.name) fails.push(`rail dot ${i} reads "${rails[i].dataset.label}", the screen is "${el.dataset.name}"`);
    });

    console.log(fails.length ? 'BROKERS CHECK FAIL\n' + fails.join('\n')
      : `BROKERS CHECK OK — ${cards.length} brokers, showing ${showing}, ${tables.length ? `${top / 100} per lot at the top of ${tables.length} tables` : 'its record pending'}`);
  }
})();
