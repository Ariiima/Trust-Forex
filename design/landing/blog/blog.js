/* TrustForex Blog — the listing's filter, sort and "show more"; the post's contents rail and copy link.
   cb8/main.js (loaded first) owns the scroll, the reveal and the icons. Everything here degrades to the static
   page: the chips are real links to the category pages, the grid is complete in the HTML. */
(() => {
  const PAGE = 9;                                                 // cards shown before "Show more"
  const grid = document.getElementById('grid');
  if (grid) {
    const cards = [...grid.querySelectorAll('.card')];
    const chips = [...document.querySelectorAll('.chip[data-cat]')];
    const sort = document.getElementById('sort');
    const more = document.getElementById('more');
    const onIndex = chips.some(c => c.dataset.cat === 'all' && c.getAttribute('aria-current') === 'true');   // read before apply() moves it
    let cat = (location.hash.match(/#c=([\w-]+)/) || [])[1] || chips.find(c => c.getAttribute('aria-current') === 'true')?.dataset.cat || 'all';
    let shown = PAGE;
    const apply = () => {
      const by = sort.value;
      const order = [...cards].sort((a, b) => by === 'reads' ? +b.dataset.reads - +a.dataset.reads : by === 'old' ? a.dataset.date.localeCompare(b.dataset.date) : b.dataset.date.localeCompare(a.dataset.date));
      order.forEach(c => grid.appendChild(c));               // reorder in place; the reveal has already run
      const match = order.filter(c => cat === 'all' || c.dataset.cat === cat);
      order.forEach(c => { c.hidden = !match.includes(c) || match.indexOf(c) >= shown; });
      more.hidden = match.length <= shown;
      chips.forEach(c => c.setAttribute('aria-current', c.dataset.cat === cat ? 'true' : 'false'));
    };
    chips.forEach(c => c.addEventListener('click', e => {
      if (!onIndex) return;   // a category page: follow the link
      e.preventDefault(); cat = c.dataset.cat; shown = PAGE;
      history.replaceState(null, '', cat === 'all' ? location.pathname : `#c=${cat}`);
      apply();
    }));
    sort.addEventListener('change', apply);
    more.addEventListener('click', () => { shown += PAGE; apply(); });
    apply();
  }

  /* the post: the current heading lights its entry in "On this page"; the link copies */
  const toc = document.querySelector('.toc');
  if (toc && !document.getElementById('pv-body')) {
    const links = [...toc.querySelectorAll('a')];
    const heads = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) links.forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id ? 'true' : 'false')); });
    }, { rootMargin: '-20% 0px -70% 0px' });
    heads.forEach(h => io.observe(h));
  }
  const copy = document.querySelector('.copy-link');
  if (copy) copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(copy.dataset.url); copy.textContent = 'Link copied'; copy.classList.add('done'); setTimeout(() => { copy.textContent = 'Copy link'; copy.classList.remove('done'); }, 1800); } catch { prompt('Copy this link', copy.dataset.url); }
  });
})();
