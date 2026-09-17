/* Referral — what this page adds beyond cb8/main.js: the rate rail on 03 is a chooser.
   The four tiles are the four current Signal plans; picking one recomputes the example
   beneath it at that plan's referral rate. Diamond ships selected. */
(() => {
  const CASHBACK = 120;                                  // the example's fixed credited amount
  const reward = (rate) => CASHBACK * rate / 100;        // the whole calculation, one line

  const rail = document.querySelector('.rate-rail');
  const pct = document.getElementById('rate-pct');
  const out = document.getElementById('rate-reward');
  const note = document.getElementById('rate-note');
  /* the three figures roll, they do not blink: the cashback calculator's estimate motion, lifted into
     shared/roll.js (founder, 2026-09-18: "the number change motion specially") */
  const rolls = [pct, out, note].map((el) => window.tfRoll?.(el) || null);
  const [pctRoll, outRoll, noteRoll] = rolls;

  if (rail && pct) {
    const cells = [...rail.querySelectorAll('.rate-cell')];
    /* the white rim rides the rail and its halo takes the new tier's colour as it goes; the metal
       itself never travels — each tile deepens or lightens its own, timed to the box (cb8/style.css).
       The rims are written out: a registered @property read through another variable will not blend
       (partnership/page.css carries the same note). */
    const RIM = {
      standard: 'rgba(236,176,136,.5)', silver: 'rgba(228,238,250,.55)',
      gold: 'rgba(240,208,130,.55)', diamond: 'rgba(196,166,250,.55)',
    };
    /* the calculator's own curve, a touch longer than its 700ms beat: the rail is wider than the
       level bar, so the same curve over 780ms reads as quick without whipping (founder, 2026-09-18:
       "calculator is fast, this isn't", then "make it a little slower") */
    const knob = window.tfKnob?.(rail, cells, {
      className: 'rail-knob', spring: 'tight', duration: 780,
      ink: (el) => ({ '--k-rim': RIM[el.dataset.tier] || RIM.gold }),
    });
    cells.forEach((b) => b.addEventListener('click', () => {
      if (b.getAttribute('aria-pressed') === 'true') return;
      cells.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      knob?.move(b, true);
      const n = reward(+b.dataset.rate);
      pctRoll?.set(`${b.dataset.rate}%`);
      outRoll?.set(`+$${n.toLocaleString('en-US')}`);
      noteRoll?.set(`$${n.toLocaleString('en-US')}`);
    }));
  }

  /* ---------- self-check: the numbers the page ships with must be the ones it computes ---------- */
  if (new URLSearchParams(location.search).get('check') === '1') {
    const fails = [];
    if (reward(10) !== 12) fails.push(`10% of $${CASHBACK} is ${reward(10)}, not 12`);
    if (reward(30) !== 36) fails.push(`30% of $${CASHBACK} is ${reward(30)}, not 36`);
    const cells = [...document.querySelectorAll('.rate-cell')];
    cells.forEach((c) => {
      if (c.querySelector('strong').textContent.trim() !== `${c.dataset.rate}%`)
        fails.push(`${c.dataset.tier} tile shows ${c.querySelector('strong').textContent}, data-rate says ${c.dataset.rate}%`);
    });
    const on = cells.filter((c) => c.getAttribute('aria-pressed') === 'true');
    if (on.length !== 1) fails.push(`${on.length} tiles are selected, exactly 1 must be`);
    /* the knob wears the picked tier's own halo: its rim must be the rim that tile would have drawn,
       or the pick changes colour the moment the script loads */
    const knobEl = document.querySelector('.rail-knob');
    if (!knobEl) fails.push('the rate rail has no knob');
    else if (on.length === 1) {
      const probe = document.createElement('span');                       // the tile's pressed tint, read off the sheet
      probe.className = 'tile rate-cell';
      probe.dataset.tier = on[0].dataset.tier;
      probe.setAttribute('aria-pressed', 'true');
      probe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px';
      rail.append(probe);
      const want = getComputedStyle(probe).getPropertyValue('--rim').trim();
      probe.remove();
      const worn = getComputedStyle(knobEl).getPropertyValue('--k-rim').trim();
      // the sheet writes .5 and the computed style reads 0.5: compare the numbers, not the text
      const nums = (v) => (v.match(/[\d.]+/g) || []).map(Number).join(',');
      const same = (a, b) => nums(a) === nums(b);
      if (want && !same(want, worn)) fails.push(`the knob's halo is ${worn}, the ${on[0].dataset.tier} tile's rim is ${want}`);
      const face = getComputedStyle(on[0]).getPropertyValue('--cell-tint').trim();
      if (!face || face === 'transparent') fails.push('the picked tile has no metal of its own; only the rim may travel');
    }
    if (!document.querySelector('#rate-reward .tf-roll')) fails.push('the reward figure does not roll');
    const card = document.querySelector('.plan-card');                 // 04's preview IS the plan 03 ships selected: no pill, the card wears the tier
    if (!card) fails.push('the App preview has no plan card on its rate cell');
    if (card && card.querySelector('.plan-pill')) fails.push('the plan card still holds a pill; the card itself is the pill');
    if (card && on.length === 1 && card.dataset.tier !== on[0].dataset.tier)
      fails.push(`plan card says ${card.dataset.tier}, the selected tile is ${on[0].dataset.tier}`);
    if (card && on.length === 1 && !card.querySelector('small').textContent.trim().toLowerCase().startsWith(on[0].dataset.tier))
      fails.push(`plan card label reads "${card.querySelector('small').textContent.trim()}", its data-tier is ${card.dataset.tier}`);
    if (on.length === 1) {
      const r = +on[0].dataset.rate;
      if (pct.textContent.trim() !== `${r}%`) fails.push(`shipped rate ${pct.textContent} != selected tile's ${r}%`);
      if (out.textContent.trim() !== `+$${reward(r)}`) fails.push(`shipped reward ${out.textContent} != +$${reward(r)}`);
      if (note.textContent.trim() !== `$${reward(r)}`) fails.push(`shipped note ${note.textContent} != $${reward(r)}`);
      if (card && card.querySelector('strong').textContent.trim() !== `${r}%`)
        fails.push(`plan card shows ${card.querySelector('strong').textContent.trim()}, the selected tile is ${r}%`);
      const toast = document.querySelector('.toast strong');           // the preview's notification is one reward at that rate
      if (toast && toast.textContent.trim() !== `+$${reward(r)} referral reward`)
        fails.push(`toast reads "${toast.textContent.trim()}", the rate gives +$${reward(r)}`);
    }
    console.log(fails.length ? 'REFERRAL CHECK FAIL\n' + fails.join('\n') : `REFERRAL CHECK OK — ${cells.length} rate tiles, example at ${pct.textContent}`);
  }
})();
