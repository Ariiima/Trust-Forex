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
  const live = document.getElementById('chart-live');
  const scalpStage = document.getElementById('scalp-stage');
  const scalpBars = document.getElementById('scalp-bars');
  const scalpTooltip = document.getElementById('scalp-tooltip');
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

  function drawCompare() {
    const geometry = chartGeometry(), count = data[timeframe].length, centers = slotCenters();
    const xAt = index => centers.length === count ? centers[index] : geometry.left + (count === 1 ? geometry.plotWidth / 2 : (index / (count - 1)) * geometry.plotWidth);
    compareChart.setAttribute('viewBox', '0 0 ' + geometry.width + ' ' + geometry.height);
    compareChart.innerHTML = '';
    /* a period with no signals is not a zero — the bars leave a dashed stub where the column would be,
       so the lines leave the same stub and break, rather than ruling straight across a period nothing
       was recorded in. A lone reading between two empty periods is drawn as a dot. */
    const baseline = geometry.top + geometry.plotHeight;
    data[timeframe].forEach((item, index) => {
      if (item.total) return;
      const stub = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stub.setAttribute('x1', String(xAt(index))); stub.setAttribute('x2', String(xAt(index)));
      stub.setAttribute('y1', String(baseline - 18)); stub.setAttribute('y2', String(baseline));
      stub.setAttribute('class', 'compare-gap'); compareChart.appendChild(stub);
    });
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
      if (count <= 6) {
        const color = getComputedStyle(document.documentElement).getPropertyValue('--' + targetName).trim();
        current.forEach((item, index) => {
          if (item.rate === null) return;
          const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          point.setAttribute('cx', String(xAt(index)));
          point.setAttribute('cy', String(geometry.top + (100 - item.rate) / 100 * geometry.plotHeight)); point.setAttribute('r', '4'); point.setAttribute('fill', color); point.setAttribute('class', 'compare-point'); compareChart.appendChild(point);
        });
      }
    });
  }

  function draw() {
    barsNode.innerHTML = ''; activeIndex = null; pinned = false; tooltip.style.opacity = '0'; chartStage.dataset.timeframe = timeframe;
    const current = rowsFor(target);
    chartStage.setAttribute('aria-label', compareMode ? 'Comparing TP1 through TP4 across ' + current.length + ' ' + timeframe + ' periods' : target.toUpperCase() + ' Win Rate across ' + current.length + ' ' + timeframe + ' periods');
    current.forEach((item, index) => {
      const slot = document.createElement('div'); slot.className = 'bar-slot' + (item.rate === null ? ' no-signals' : ''); slot.dataset.index = String(index);
      const bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = item.rate === null ? '18px' : item.rate + '%'; bar.style.setProperty('--i', index); slot.appendChild(bar); barsNode.appendChild(slot);
    });
    drawCompare();
  }

  function showIndex(index, clientY) {
    const current = rowsFor(target), slots = [...barsNode.children], item = current[index], stageBounds = chartStage.getBoundingClientRect(); activeIndex = index;
    slots.forEach((slot, i) => slot.classList.toggle('active', i === index));
    const center = slotCenters()[index];   // the lit column is the reading's marker — no rule is drawn through it
    if (item.rate === null) {
      tooltip.innerHTML = '<strong>' + item.period + '</strong><span>No Signals</span>';
      live.textContent = item.period + ', No Signals.';
    } else if (compareMode) {
      const detail = targets.map(targetName => rowsFor(targetName)[index]);
      tooltip.innerHTML = '<strong>' + item.period + '</strong><span class="compare-total">' + item.total + ' Total Signals</span>' + targets.map((targetName, i) => '<div class="compare-row" style="--dot:var(--' + targetName + ')"><i class="compare-dot"></i><b>' + targetName.toUpperCase() + '</b><em>' + detail[i].rate + '% · ' + detail[i].hits + '/' + detail[i].total + '</em></div>').join('');
      live.textContent = item.period + ', ' + detail.map((row, i) => targets[i].toUpperCase() + ' ' + row.rate + ' percent').join(', ') + '.';
    } else {
      tooltip.innerHTML = '<strong>' + item.period + '</strong><span>' + item.rate + '% Win Rate</span><span>' + item.hits + ' of ' + item.total + ' reached ' + target.toUpperCase() + '</span>';
      live.textContent = item.period + ', ' + item.rate + ' percent Win Rate, ' + item.hits + ' of ' + item.total + ' reached ' + target.toUpperCase() + '.';
    }
    const tipX = Math.max(100, Math.min(chartStage.clientWidth - 100, center));
    const tipY = Math.max(96, Math.min(chartStage.clientHeight - 20, clientY - stageBounds.top));
    tooltip.style.left = tipX + 'px'; tooltip.style.top = tipY + 'px'; tooltip.style.opacity = '1';
  }

  function showAt(clientX, clientY) {
    const centers = slotCenters(); if (!centers.length) return;
    const x = clientX - chartStage.getBoundingClientRect().left;
    let index = 0; centers.forEach((center, i) => { if (Math.abs(center - x) < Math.abs(centers[index] - x)) index = i; });
    showIndex(index, clientY);
  }

  function closeTooltip() { [...barsNode.children].forEach(slot => slot.classList.remove('active')); activeIndex = null; pinned = false; tooltip.style.opacity = '0'; }
  chartStage.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || event.buttons) showAt(event.clientX, event.clientY); });
  chartStage.addEventListener('pointerdown', event => { pinned = true; showAt(event.clientX, event.clientY); });
  chartStage.addEventListener('pointerleave', () => { if (!pinned) closeTooltip(); });
  document.addEventListener('pointerdown', event => { if (pinned && !chartStage.contains(event.target)) closeTooltip(); });
  chartStage.addEventListener('keydown', event => {
    const count = data[timeframe].length; if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return; event.preventDefault();
    if (event.key === 'Escape') { closeTooltip(); return; }
    if (event.key === 'Home') activeIndex = 0; else if (event.key === 'End') activeIndex = count - 1; else if (event.key === 'ArrowLeft') activeIndex = Math.max(0, (activeIndex ?? count) - 1); else activeIndex = Math.min(count - 1, (activeIndex ?? -1) + 1);
    pinned = true; showIndex(activeIndex, chartStage.getBoundingClientRect().top + chartStage.clientHeight * .45);
  });

  function drawScalp() {
    const rows = scalpData[scalpTimeframe]; scalpBars.innerHTML = ''; scalpActiveIndex = null; scalpPinned = false; scalpTooltip.style.opacity = '0';
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

  function showScalpIndex(index, clientY) {
    const rows = scalpData[scalpTimeframe]; if (!rows.length) return;
    const slots = [...scalpBars.children], item = rows[index], stageBounds = scalpStage.getBoundingClientRect(), slotBounds = slots[index].getBoundingClientRect(); scalpActiveIndex = index;
    slots.forEach((slot, i) => slot.classList.toggle('active', i === index));
    const center = slotBounds.left - stageBounds.left + slotBounds.width / 2;
    scalpTooltip.innerHTML = '<strong>' + item.period + '</strong><span>' + item.levels + ' Touched Levels</span><span>Average Bounce +' + item.bounce + ' pips</span><span>Average First Breach −' + item.breach + ' pips</span>';
    scalpLive.textContent = item.period + ', ' + item.levels + ' Touched Levels, Average Bounce ' + item.bounce + ' pips, Average First Breach minus ' + item.breach + ' pips.';
    const tipX = Math.max(105, Math.min(scalpStage.clientWidth - 105, center));
    const tipY = Math.max(100, Math.min(scalpStage.clientHeight - 50, clientY - stageBounds.top));
    scalpTooltip.style.left = tipX + 'px'; scalpTooltip.style.top = tipY + 'px'; scalpTooltip.style.opacity = '1';
  }

  function showScalpAt(clientX, clientY) {
    const rows = scalpData[scalpTimeframe]; if (!rows.length) return;
    const bounds = scalpBars.getBoundingClientRect(); const relative = Math.max(0, Math.min(bounds.width - 1, clientX - bounds.left)); const index = Math.min(rows.length - 1, Math.floor(relative / bounds.width * rows.length)); showScalpIndex(index, clientY);
  }
  function closeScalpTooltip() { [...scalpBars.children].forEach(slot => slot.classList.remove('active')); scalpActiveIndex = null; scalpPinned = false; scalpTooltip.style.opacity = '0'; }
  scalpStage.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || event.buttons) showScalpAt(event.clientX, event.clientY); });
  scalpStage.addEventListener('pointerdown', event => { scalpPinned = true; showScalpAt(event.clientX, event.clientY); });
  scalpStage.addEventListener('pointerleave', () => { if (!scalpPinned) closeScalpTooltip(); });
  document.addEventListener('pointerdown', event => { if (scalpPinned && !scalpStage.contains(event.target)) closeScalpTooltip(); });
  scalpStage.addEventListener('keydown', event => {
    const count = scalpData[scalpTimeframe].length; if (!count || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return; event.preventDefault();
    if (event.key === 'Escape') { closeScalpTooltip(); return; }
    if (event.key === 'Home') scalpActiveIndex = 0; else if (event.key === 'End') scalpActiveIndex = count - 1; else if (event.key === 'ArrowLeft') scalpActiveIndex = Math.max(0, (scalpActiveIndex ?? count) - 1); else scalpActiveIndex = Math.min(count - 1, (scalpActiveIndex ?? -1) + 1);
    scalpPinned = true; showScalpIndex(scalpActiveIndex, scalpStage.getBoundingClientRect().top + scalpStage.clientHeight * .42);
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
    if (document.querySelectorAll('#compare-chart .compare-gap').length !== 1) fails.push('the No Signals week lost its stub');
    console.log(fails.length ? 'CHART FAIL\n' + fails.join('\n') : 'CHART OK — 30 weekly slots, week 13 No Signals');
  }
})();
