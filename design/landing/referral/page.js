/* Referral — what this page adds beyond cb8/main.js: the rate rail on 03 is a chooser.
   The four tiles are the four current Signal plans; picking one recomputes the example
   beneath it at that plan's referral rate. Gold ships selected. */
(() => {
  const CASHBACK = 120;                                  // the example's fixed credited amount
  const reward = (rate) => CASHBACK * rate / 100;        // the whole calculation, one line

  const rail = document.querySelector('.rate-rail');
  const pct = document.getElementById('rate-pct');
  const out = document.getElementById('rate-reward');
  const note = document.getElementById('rate-note');
  const swap = (el) => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); };

  if (rail && pct) {
    const cells = [...rail.querySelectorAll('.rate-cell')];
    cells.forEach((b) => b.addEventListener('click', () => {
      if (b.getAttribute('aria-pressed') === 'true') return;
      cells.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      const n = reward(+b.dataset.rate);
      pct.textContent = `${b.dataset.rate}%`;
      out.textContent = `+$${n.toLocaleString('en-US')}`;
      note.textContent = `$${n.toLocaleString('en-US')}`;
      [pct, out].forEach(swap);                          // cross-fade, never a count-up
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
    if (on.length === 1) {
      const r = +on[0].dataset.rate;
      if (pct.textContent.trim() !== `${r}%`) fails.push(`shipped rate ${pct.textContent} != selected tile's ${r}%`);
      if (out.textContent.trim() !== `+$${reward(r)}`) fails.push(`shipped reward ${out.textContent} != +$${reward(r)}`);
      if (note.textContent.trim() !== `$${reward(r)}`) fails.push(`shipped note ${note.textContent} != $${reward(r)}`);
    }
    console.log(fails.length ? 'REFERRAL CHECK FAIL\n' + fails.join('\n') : `REFERRAL CHECK OK — ${cells.length} rate tiles, example at ${pct.textContent}`);
  }
})();
