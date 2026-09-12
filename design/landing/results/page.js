/* TrustForex Results — the explorer: the wireframe's own chart code (result.html, final), untouched in its
   maths and its keyboard/pointer grammar. cb8/main.js (loaded first) owns the scroll, the reveal, the icons
   and the FAQ; this file owns the two charts. Sample data is the wireframe's. */
(() => {
  const explorer = document.querySelector('.explorer');
  const chartStage = document.getElementById('chart-stage');
  const barsNode = document.getElementById('bars');
  const compareChart = document.getElementById('compare-chart');
  const compareToggle = document.getElementById('compare-toggle');
  const targetSelector = document.querySelector('.selector.target');
  const tooltip = document.getElementById('tooltip');
  const tipAnchor = document.getElementById('tip-anchor');
  const tipLayer = document.querySelector('.tip-layer');
  const live = document.getElementById('chart-live');
  const scalpStage = document.getElementById('scalp-stage');
  const scalpBars = document.getElementById('scalp-bars');
  const scalpTooltip = document.getElementById('scalp-tooltip');
  const scalpAnchor = document.getElementById('scalp-anchor');
  const scalpLive = document.getElementById('scalp-live');
  const base = { tp1: 84, tp2: 68, tp3: 49, tp4: 31 };
  const targets = ['tp1', 'tp2', 'tp3', 'tp4'];
  const weeklyDates = ['4 Feb 2026', '11 Feb 2026', '18 Feb 2026', '25 Feb 2026', '4 Mar 2026', '11 Mar 2026', '18 Mar 2026', '25 Mar 2026', '1 Apr 2026', '8 Apr 2026', '15 Apr 2026', '22 Apr 2026', '29 Apr 2026', '6 May 2026', '13 May 2026', '20 May 2026', '27 May 2026', '3 Jun 2026', '10 Jun 2026', '17 Jun 2026', '24 Jun 2026', '1 Jul 2026', '8 Jul 2026', '15 Jul 2026', '22 Jul 2026', '29 Jul 2026', '5 Aug 2026', '12 Aug 2026', '19 Aug 2026', '26 Aug 2026'];
  const months = ['Mar 2024', 'Apr 2024', 'May 2024', 'Jun 2024', 'Jul 2024', 'Aug 2024', 'Sep 2024', 'Oct 2024', 'Nov 2024', 'Dec 2024', 'Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025', 'Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026'];
  const data = {
    weekly: weeklyDates.map((period, index) => ({ period, total: index === 12 ? 0 : 6 + (index % 8), seed: index })),
    monthly: months.map((period, index) => ({ period, total: index === 8 ? 0 : 28 + (index % 19), seed: index + 4 })),
    yearly: ['Q4 2025', 'Q1 2026', 'Q2 2026'].map((period, index) => ({ period, total: 86 + index * 11, seed: index + 8 }))
  };
  const scalpData = {
    weekly: [
      { label: 'Week 31', period: '27–31 Jul 2026', levels: 6, bounce: 27, breach: 7 },
      { label: 'Week 32', period: '3–7 Aug 2026', levels: 8, bounce: 38, breach: 11 },
      { label: 'Week 33', period: '10–14 Aug 2026', levels: 5, bounce: 24, breach: 6 },
      { label: 'Week 34', period: '17–21 Aug 2026', levels: 9, bounce: 42, breach: 14 }
    ],
    monthly: [
      { label: 'Jul 2026', period: 'July 2026', levels: 6, bounce: 27, breach: 7 },
      { label: 'Aug 2026', period: 'August 2026', levels: 22, bounce: 35, breach: 10 }
    ],
    yearly: []
  };
  let target = 'tp2', timeframe = 'weekly', activeIndex = null, compareMode = false, pinned = false;
  let resultView = 'signals', scalpTimeframe = 'weekly', scalpActiveIndex = null, scalpPinned = false;
  let compareCursor = null, compareDots = null;   /* the dashed rule and the four dots that mark the hovered period while compare is on */

  const tipHead = (period, pill) => '<div class="tip-head"><strong>' + period + '</strong>' + (pill ? '<span class="tip-pill">' + pill + '</span>' : '') + '</div>';

  /* The card hangs off the mark it reads: a ring on the mark's top edge, a stem, then the card above it.
     `top` is the card's bottom edge, since the card is translated up by its own height. Where the mark runs
     too high for the card to clear it the stem closes to nothing and the card overlaps the plot instead of
     leaving the stage. The ring keeps the mark's own x while the card is held inside the stage.
     `beside` sets the card next to x rather than over it: compare marks the reading with a rule down the
     whole plot, and a card straddling that rule hides the very crossing it is reporting. It goes to the
     right of the rule, or to the left where the right would run out of stage. */
  function anchorCard(card, ring, stage, x, markTop, showRing, beside) {
    const height = card.offsetHeight, half = card.offsetWidth / 2, limit = stage.clientWidth - half - 2;
    const wanted = beside ? (x + 14 + half > limit ? x - 14 - half : x + 14 + half) : x;
    const bottom = Math.max(height + 2, markTop - 26);   // the gap the bead and its thread live in
    /* x and markTop arrive in the stage's own space; the layer is fixed to the viewport, so the stage's
       corner is added on the way out. Held here rather than in the callers, which all measure the same way. */
    const origin = stage.getBoundingClientRect();
    card.style.setProperty('--x', origin.left + Math.max(half + 2, Math.min(limit, wanted)) + 'px');
    card.style.setProperty('--y', origin.top + bottom + 'px');
    card.style.opacity = '1';
    ring.style.setProperty('--x', origin.left + x + 'px'); ring.style.setProperty('--y', origin.top + markTop + 'px');
    ring.style.setProperty('--stem', Math.max(0, markTop - bottom - 8) + 'px');   // outer circle's top edge up to the card
    ring.classList.toggle('on', showRing);
  }

  /* Everything that marks a reading travels to the next one rather than cutting to it. A reading that is
     opening has no previous place to travel from, so that first placement runs inside `no-ease`: the class
     goes on, the positions land, one forced reflow settles them, and the class comes off before the mouse
     can move again. */
  function place(stage, card, run) {
    const opening = card.style.opacity !== '1';
    if (opening) { stage.classList.add('no-ease'); tipLayer.classList.add('no-ease'); }
    run();
    if (opening) { void stage.offsetWidth; stage.classList.remove('no-ease'); tipLayer.classList.remove('no-ease'); }
  }

  /* stage-relative top of a mark, which is what the ring sits on */
  function markTopOf(node, stage) { return node.getBoundingClientRect().top - stage.getBoundingClientRect().top; }

  function rowsFor(targetName) {
    return data[timeframe].map((item, index) => {
      if (!item.total) return { ...item, hits: 0, rate: null };
      const shift = Math.sin((index + item.seed * .17) * 1.1) * 9 + Math.cos(index * .48) * 4;
      const estimated = Math.max(3, Math.min(96, Math.round(base[targetName] + shift)));
      const hits = Math.min(item.total, Math.round(item.total * estimated / 100));
      return { ...item, hits, rate: Math.round(hits / item.total * 100) };
    });
  }

  function chartGeometry() {
    const width = chartStage.clientWidth, height = chartStage.clientHeight, left = window.innerWidth <= 560 ? 44 : 54, right = 8, top = 30, bottom = 2;
    return { width, height, left, right, top, bottom, plotWidth: width - left - right, plotHeight: height - top - bottom };
  }

  /* the bars are a flex row with its own padding and gaps, so an evenly divided plot width lands
     between the columns. The compare line, the tooltip and the hit test all read x off the slots themselves. */
  function slotCenters() {
    const stageBounds = chartStage.getBoundingClientRect();
    return [...barsNode.children].map(slot => { const bounds = slot.getBoundingClientRect(); return bounds.left - stageBounds.left + bounds.width / 2; });
  }

  /* A running animation keeps its element on its own composited layer, and a composited layer is left out
     of the reading card's backdrop — the four lines drew themselves in and then stayed sharp behind the
     glass while everything else frosted. The entry only has to play once, so the animation is dropped the
     moment it ends and the line rejoins the page the card is blurring. */
  function settle(node, ended) {
    node.addEventListener('animationend', () => { ended(); node.style.animation = 'none'; }, { once: true });
  }

  function drawCompare() {
    const geometry = chartGeometry(), count = data[timeframe].length, centers = slotCenters();
    const xAt = index => centers.length === count ? centers[index] : geometry.left + (count === 1 ? geometry.plotWidth / 2 : (index / (count - 1)) * geometry.plotWidth);
    compareChart.setAttribute('viewBox', '0 0 ' + geometry.width + ' ' + geometry.height);
    compareChart.innerHTML = '';
    /* a period with no signals is not a zero — every line breaks there rather than ruling straight across a
       period nothing was recorded in. The break is the whole mark: the slot is clenched to a sliver, so the
       lines close up over it and nothing is drawn in the hole. A lone reading between two empty periods is a dot. */
    compareCursor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    compareCursor.setAttribute('class', 'compare-cursor');
    compareCursor.setAttribute('x1', '0'); compareCursor.setAttribute('x2', '0');   // the rule is drawn at zero and moved by transform, which is what lets it ease
    compareCursor.setAttribute('y1', String(geometry.top)); compareCursor.setAttribute('y2', String(geometry.top + geometry.plotHeight));
    compareChart.appendChild(compareCursor);   // first, so the four lines cross over the rule rather than under it
    targets.forEach(targetName => {
      const current = rowsFor(targetName); let path = '', run = [];
      const flush = () => {
        if (run.length) path += ' M ' + run[0] + (run.length === 1 ? ' L ' + run[0] : run.slice(1).map(point => ' L ' + point).join(''));
        run = [];
      };
      current.forEach((item, index) => {
        if (item.rate === null) { flush(); return; }
        run.push(xAt(index).toFixed(2) + ' ' + (geometry.top + (100 - item.rate) / 100 * geometry.plotHeight).toFixed(2));
      });
      flush();
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', path.trim()); line.setAttribute('class', 'compare-path ' + targetName); line.setAttribute('pathLength', '1'); compareChart.appendChild(line);
      settle(line, () => { line.style.strokeDashoffset = '0'; });   // the line's own rule leaves it at 1, i.e. undrawn; the animation was holding it open
      if (count <= 6) {
        const color = getComputedStyle(document.documentElement).getPropertyValue('--' + targetName).trim();
        current.forEach((item, index) => {
          if (item.rate === null) return;
          const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          point.setAttribute('cx', String(xAt(index)));
          point.setAttribute('cy', String(geometry.top + (100 - item.rate) / 100 * geometry.plotHeight)); point.setAttribute('r', '4'); point.setAttribute('fill', color); point.setAttribute('class', 'compare-point'); compareChart.appendChild(point); settle(point, () => { point.style.opacity = '1'; });
        });
      }
    });
    /* the four reading dots go on last, over every line, and are moved rather than rebuilt on each hover */
    compareDots = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    targets.forEach(targetName => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('class', 'compare-live-dot ' + targetName); dot.setAttribute('r', '5'); compareDots.appendChild(dot);
    });
    compareChart.appendChild(compareDots);
  }

  function placeCompareDots(index) {
    if (!compareDots) return;
    const geometry = chartGeometry(), x = slotCenters()[index];
    targets.forEach((targetName, i) => {
      const row = rowsFor(targetName)[index], dot = compareDots.children[i];
      if (!compareMode || row.rate === null) { dot.style.opacity = '0'; return; }
      dot.style.opacity = '1'; dot.dataset.x = String(x);
      dot.style.transform = 'translate(' + x + 'px,' + (geometry.top + (100 - row.rate) / 100 * geometry.plotHeight) + 'px)';
    });
  }

  /* The columns are built once per grain and then re-read, never rebuilt per target. Rebuilding them
     replayed the entry animation on every TP click, and the browser left some of the fresh columns
     unpainted until the next repaint — which is why a hover brought the missing ones back. Reusing the
     nodes also lets `transition:height` morph TP1 into TP4 instead of restarting the chart. */
  function draw() {
    closeTooltip(); chartStage.dataset.timeframe = timeframe;
    const current = rowsFor(target);
    chartStage.setAttribute('aria-label', compareMode ? 'Comparing TP1 through TP4 across ' + current.length + ' ' + timeframe + ' periods' : target.toUpperCase() + ' Win Rate across ' + current.length + ' ' + timeframe + ' periods');
    if (barsNode.children.length !== current.length) {
      barsNode.innerHTML = '';
      current.forEach((item, index) => {
        const slot = document.createElement('div'); slot.className = 'bar-slot'; slot.dataset.index = String(index);
        const bar = document.createElement('div'); bar.className = 'bar'; bar.style.setProperty('--i', index); slot.appendChild(bar); barsNode.appendChild(slot);
      });
    }
    current.forEach((item, index) => {
      const slot = barsNode.children[index];
      slot.classList.toggle('no-signals', item.rate === null);
      slot.firstElementChild.style.height = item.rate === null ? '12px' : item.rate + '%';
    });
    drawCompare();
  }

  function showIndex(index) {
    const current = rowsFor(target), slots = [...barsNode.children], item = current[index], geometry = chartGeometry(); activeIndex = index;
    slots.forEach((slot, i) => slot.classList.toggle('active', i === index));
    const center = slotCenters()[index];   // reading TP1–TP4 the lit column is the marker; compare hides it, so the rule takes over
    if (item.rate === null) {
      tooltip.innerHTML = tipHead(item.period) + '<div class="tip-empty">No Signals</div>';
      live.textContent = item.period + ', No Signals.';
    } else if (compareMode) {
      const detail = targets.map(targetName => rowsFor(targetName)[index]);
      tooltip.innerHTML = tipHead(item.period, item.total + ' Signals') + '<div class="tip-split quad">' + targets.map((targetName, i) =>
        '<div class="tip-cell" style="--tp-ink:var(--' + targetName + '-ink)"><i>' + targetName.toUpperCase() + '</i><b>' + detail[i].rate + '%</b><em>' + detail[i].hits + '/' + detail[i].total + '</em></div>').join('') + '</div>';
      live.textContent = item.period + ', ' + detail.map((row, i) => targets[i].toUpperCase() + ' ' + row.rate + ' percent').join(', ') + '.';
    } else {
      tooltip.innerHTML = tipHead(item.period) + '<div class="tip-split">'
        + '<div class="tip-cell"><b class="pos">' + item.rate + '%</b><i>Win Rate</i></div>'
        + '<div class="tip-cell"><b>' + item.hits + ' of ' + item.total + '</b><i>Reached ' + target.toUpperCase() + '</i></div></div>';
      live.textContent = item.period + ', ' + item.rate + ' percent Win Rate, ' + item.hits + ' of ' + item.total + ' reached ' + target.toUpperCase() + '.';
    }
    /* compare has four readings and so no single mark to hang off — the card sits at the top of the plot and
       the dashed rule carries the x. A period with no signals has no mark to hang off either, so its card
       rests in the middle of the plot with no ring and nothing drawn down to the axis: there is no reading
       down there to point at. Reading one target, the card hangs off that column's top edge. */
    const hanging = !compareMode && item.rate !== null;
    const markTop = compareMode ? geometry.top + 8 + tooltip.offsetHeight + 16
      : hanging ? markTopOf(slots[index].firstElementChild, chartStage)
      : geometry.top + geometry.plotHeight / 2 + tooltip.offsetHeight / 2 + 16;
    place(chartStage, tooltip, () => {
      if (compareCursor) {
        compareCursor.style.transform = 'translateX(' + center + 'px)'; compareCursor.dataset.x = String(center);
        compareCursor.classList.toggle('on', compareMode);
      }
      placeCompareDots(index);
      anchorCard(tooltip, tipAnchor, chartStage, center, markTop, hanging, compareMode);
    });
  }

  function showAt(clientX) {
    const centers = slotCenters(); if (!centers.length) return;
    const x = clientX - chartStage.getBoundingClientRect().left;
    let index = 0; centers.forEach((center, i) => { if (Math.abs(center - x) < Math.abs(centers[index] - x)) index = i; });
    showIndex(index);
  }

  function closeTooltip() { [...barsNode.children].forEach(slot => slot.classList.remove('active')); activeIndex = null; pinned = false; tooltip.style.opacity = '0'; tipAnchor.classList.remove('on'); if (compareCursor) compareCursor.classList.remove('on'); if (compareDots) [...compareDots.children].forEach(dot => { dot.style.opacity = '0'; }); }
  chartStage.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || event.buttons) showAt(event.clientX); });
  chartStage.addEventListener('pointerdown', event => { pinned = true; showAt(event.clientX); });
  chartStage.addEventListener('pointerleave', () => { if (!pinned) closeTooltip(); });
  document.addEventListener('pointerdown', event => { if (pinned && !chartStage.contains(event.target)) closeTooltip(); });
  chartStage.addEventListener('keydown', event => {
    const count = data[timeframe].length; if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return; event.preventDefault();
    if (event.key === 'Escape') { closeTooltip(); return; }
    if (event.key === 'Home') activeIndex = 0; else if (event.key === 'End') activeIndex = count - 1; else if (event.key === 'ArrowLeft') activeIndex = Math.max(0, (activeIndex ?? count) - 1); else activeIndex = Math.min(count - 1, (activeIndex ?? -1) + 1);
    pinned = true; showIndex(activeIndex);
  });

  /* the cards are fixed to the viewport while the chart scrolls under them, so a scroll ends the reading
     rather than leaving a card pointing at nothing */
  addEventListener('scroll', () => { closeTooltip(); closeScalpTooltip(); }, { passive: true });

  function drawScalp() {
    const rows = scalpData[scalpTimeframe]; scalpBars.innerHTML = ''; scalpActiveIndex = null; scalpPinned = false; scalpTooltip.style.opacity = '0'; scalpAnchor.classList.remove('on');
    scalpStage.dataset.scalpTimeframe = scalpTimeframe;   // the mark's width scales with how few columns the grain leaves
    scalpStage.classList.toggle('is-empty', rows.length === 0);
    scalpStage.setAttribute('aria-label', rows.length ? 'Average Scalp Level Bounce and First Breach in pips across ' + rows.length + ' completed ' + scalpTimeframe + ' periods' : 'No completed ' + scalpTimeframe + ' Scalp Level periods yet');
    if (!rows.length) return;
    rows.forEach((item, index) => {
      const slot = document.createElement('div'); slot.className = 'scalp-slot'; slot.dataset.index = String(index);
      const bounce = document.createElement('div'); bounce.className = 'scalp-mark bounce'; bounce.style.setProperty('--i', index); bounce.style.height = Math.min(75, item.bounce / 60 * 75) + '%'; slot.appendChild(bounce);
      const breach = document.createElement('div'); breach.className = 'scalp-mark breach'; breach.style.setProperty('--i', index); breach.style.height = Math.min(25, item.breach / 20 * 25) + '%'; slot.appendChild(breach);
      scalpBars.appendChild(slot);
    });
  }

  function showScalpIndex(index) {
    const rows = scalpData[scalpTimeframe]; if (!rows.length) return;
    const slots = [...scalpBars.children], item = rows[index], stageBounds = scalpStage.getBoundingClientRect(), slotBounds = slots[index].getBoundingClientRect(); scalpActiveIndex = index;
    slots.forEach((slot, i) => slot.classList.toggle('active', i === index));
    const center = slotBounds.left - stageBounds.left + slotBounds.width / 2;
    scalpTooltip.innerHTML = tipHead(item.period, item.levels + ' Touched Levels') + '<div class="tip-split">'
      + '<div class="tip-cell"><b class="pos">+' + item.bounce + ' pips</b><i>Average Bounce</i></div>'
      + '<div class="tip-cell"><b class="neg">−' + item.breach + ' pips</b><i>Average First Breach</i></div></div>';
    scalpLive.textContent = item.period + ', ' + item.levels + ' Touched Levels, Average Bounce ' + item.bounce + ' pips, Average First Breach minus ' + item.breach + ' pips.';
    /* the week's reading is the Bounce, so the ring sits on the Bounce block's top edge */
    place(scalpStage, scalpTooltip, () =>
      anchorCard(scalpTooltip, scalpAnchor, scalpStage, center, markTopOf(slots[index].firstElementChild, scalpStage), true, false));
  }

  function showScalpAt(clientX) {
    const rows = scalpData[scalpTimeframe]; if (!rows.length) return;
    const bounds = scalpBars.getBoundingClientRect(); const relative = Math.max(0, Math.min(bounds.width - 1, clientX - bounds.left)); const index = Math.min(rows.length - 1, Math.floor(relative / bounds.width * rows.length)); showScalpIndex(index);
  }
  function closeScalpTooltip() { [...scalpBars.children].forEach(slot => slot.classList.remove('active')); scalpActiveIndex = null; scalpPinned = false; scalpTooltip.style.opacity = '0'; scalpAnchor.classList.remove('on'); }
  scalpStage.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || event.buttons) showScalpAt(event.clientX); });
  scalpStage.addEventListener('pointerdown', event => { scalpPinned = true; showScalpAt(event.clientX); });
  scalpStage.addEventListener('pointerleave', () => { if (!scalpPinned) closeScalpTooltip(); });
  document.addEventListener('pointerdown', event => { if (scalpPinned && !scalpStage.contains(event.target)) closeScalpTooltip(); });
  scalpStage.addEventListener('keydown', event => {
    const count = scalpData[scalpTimeframe].length; if (!count || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return; event.preventDefault();
    if (event.key === 'Escape') { closeScalpTooltip(); return; }
    if (event.key === 'Home') scalpActiveIndex = 0; else if (event.key === 'End') scalpActiveIndex = count - 1; else if (event.key === 'ArrowLeft') scalpActiveIndex = Math.max(0, (scalpActiveIndex ?? count) - 1); else scalpActiveIndex = Math.min(count - 1, (scalpActiveIndex ?? -1) + 1);
    scalpPinned = true; showScalpIndex(scalpActiveIndex);
  });

  document.querySelectorAll('[data-result-view]').forEach(button => button.addEventListener('click', () => {
    resultView = button.dataset.resultView; document.querySelectorAll('[data-result-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); document.querySelectorAll('[data-mode-panel]').forEach(panel => panel.hidden = panel.dataset.modePanel !== resultView); closeTooltip(); closeScalpTooltip();
    if (resultView === 'scalp') drawScalp(); else draw();   // the hidden panel had no width to lay out against
  }));
  document.querySelectorAll('[data-scalp-timeframe]').forEach(button => button.addEventListener('click', () => {
    scalpTimeframe = button.dataset.scalpTimeframe; document.querySelectorAll('[data-scalp-timeframe]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); drawScalp();
  }));
  document.querySelectorAll('[data-target]').forEach(button => button.addEventListener('click', () => { if (compareMode) return;   /* the bar is a legend now — pointer-events stops the mouse, this stops the keyboard */
    target = button.dataset.target; document.querySelectorAll('[data-target]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); draw(); }));
  document.querySelectorAll('[data-timeframe]').forEach(button => button.addEventListener('click', () => { timeframe = button.dataset.timeframe; document.querySelectorAll('[data-timeframe]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); draw(); }));
  compareToggle.addEventListener('change', () => { compareMode = compareToggle.checked; explorer.classList.toggle('compare-mode', compareMode); targetSelector.classList.toggle('is-disabled', compareMode); targetSelector.setAttribute('aria-disabled', String(compareMode)); targetSelector.setAttribute('aria-label', compareMode ? 'Compared targets legend' : 'Target selector'); draw(); });
  window.addEventListener('resize', () => { draw(); drawScalp(); });
  draw(); drawScalp();

  /* self-check (?check=1): the rates the page ships with are the ones it computes */
  if (new URLSearchParams(location.search).get('check') === '1') {
    const fails = [];
    const w = rowsFor('tp2');
    if (w.length !== 30) fails.push(`weekly rows ${w.length} != 30`);
    if (w[12].rate !== null) fails.push('week 13 should be No Signals');
    if (w.some(r => r.rate !== null && (r.rate < 0 || r.rate > 100))) fails.push('a rate left 0–100');
    if (document.querySelectorAll('#bars .bar-slot').length !== 30) fails.push('bars not drawn');
    const runs = [...document.querySelectorAll('#compare-chart .compare-path')].map(path => (path.getAttribute('d').match(/M/g) || []).length);
    if (runs.length !== 4) fails.push(`compare lines ${runs.length} != 4`);
    if (runs.some(n => n !== 2)) fails.push('a compare line rules across the No Signals week: ' + runs.join(','));
    if (document.querySelectorAll('#compare-chart .compare-gap').length) fails.push('the compare chart still rules a stub through the No Signals week');
    const slots = [...document.querySelectorAll('#bars .bar-slot')];
    const emptyWidth = () => document.querySelectorAll('#bars .bar-slot')[12].getBoundingClientRect().width;
    const columnsWidth = emptyWidth();
    if (columnsWidth >= slots[11].getBoundingClientRect().width) fails.push('the No Signals week is not clenched');
    compareToggle.checked = true; compareToggle.dispatchEvent(new Event('change'));
    if (emptyWidth() >= columnsWidth) fails.push('compare mode does not close over the No Signals week tighter than the columns do');
    compareToggle.checked = false; compareToggle.dispatchEvent(new Event('change'));
    const firstSlot = slots[0];
    document.querySelector('[data-target=tp4]').click();
    if (document.querySelector('#bars .bar-slot') !== firstSlot) fails.push('switching target rebuilt the columns');
    document.querySelector('[data-target=tp2]').click();
    /* the rule marks the reading only while compare is on, and only while a reading is open */
    const rule = document.querySelector('#compare-chart .compare-cursor');
    if (!rule) fails.push('the compare chart has no cursor rule');
    showIndex(5);
    if (rule && rule.classList.contains('on')) fails.push('the cursor rule shows with compare off');
    /* reading one target the card hangs off that column: the ring lands on the column's top edge and the
       card's bottom clears it, so the stem has somewhere to run. */
    const stageTop = chartStage.getBoundingClientRect().top;
    const bar5 = slots[5].firstElementChild.getBoundingClientRect().top - stageTop;
    if (!tipAnchor.classList.contains('on')) fails.push('the ring does not mark the column being read');
    if (Math.abs(parseFloat(tipAnchor.style.getPropertyValue('--y')) - stageTop - bar5) > 1) fails.push('the bead is not on the column top');
    if (parseFloat(tooltip.style.getPropertyValue('--y')) - stageTop > bar5) fails.push('the card hangs below the column it reads');
    if (tooltip.closest('[style*=backdrop],.panel')) fails.push('the card is back inside the panel, where its own backdrop-filter goes inert');
    if (chartStage.classList.contains('no-ease')) fails.push('the stage was left without its easing');
    if (!tooltip.querySelector('.tip-head strong') || tooltip.querySelectorAll('.tip-cell').length !== 2) fails.push('the single-target card is not a header and two cells');
    /* a period with no signals has nothing to point at, so its card rests mid-plot and draws no ring */
    showIndex(12);
    if (tipAnchor.classList.contains('on')) fails.push('the No Signals card still draws a ring');
    const middle = chartStage.getBoundingClientRect().top + 30 + (chartStage.clientHeight - 32) / 2;
    if (Math.abs(parseFloat(tooltip.style.getPropertyValue('--y')) - tooltip.offsetHeight / 2 - middle) > 20) fails.push('the No Signals card does not rest in the middle of the plot');
    showIndex(5);
    compareToggle.checked = true; compareToggle.dispatchEvent(new Event('change'));
    showIndex(5);
    const onRule = document.querySelector('#compare-chart .compare-cursor');
    if (!onRule.classList.contains('on')) fails.push('the cursor rule does not show with compare on');
    if (onRule.getAttribute('x1') !== onRule.getAttribute('x2')) fails.push('the cursor rule is not vertical');
    if (!onRule.dataset.x) fails.push('the cursor rule was never placed');
    if (tipAnchor.classList.contains('on')) fails.push('the ring shows with compare on, where there are four readings and no single mark');
    const ruleX = parseFloat(onRule.dataset.x), cardX = parseFloat(tooltip.style.getPropertyValue('--x')) - chartStage.getBoundingClientRect().left;
    if (Math.abs(cardX - ruleX) < tooltip.offsetWidth / 2) fails.push('the compare card straddles the rule it is reading');
    if (tooltip.querySelectorAll('.tip-split.quad .tip-cell').length !== 4) fails.push('the compare card is not four columns');
    const liveDots = [...document.querySelectorAll('#compare-chart .compare-live-dot')];
    if (liveDots.length !== 4) fails.push(`compare reading dots ${liveDots.length} != 4`);
    if (liveDots.some(dot => dot.dataset.x !== onRule.dataset.x)) fails.push('a compare reading dot is off the cursor rule');
    closeTooltip();
    if (onRule.classList.contains('on')) fails.push('the cursor rule outlived the reading');
    if (liveDots.some(dot => dot.style.opacity !== '0')) fails.push('a compare reading dot outlived the reading');
    compareToggle.checked = false; compareToggle.dispatchEvent(new Event('change'));
    console.log(fails.length ? 'CHART FAIL\n' + fails.join('\n') : 'CHART OK — 30 weekly slots, week 13 No Signals');
  }
})();
