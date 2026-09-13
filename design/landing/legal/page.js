/* One page, four documents, one URL space. ?document= is the address an acceptance record
   points at, so a tab click pushes history rather than swapping content behind the reader's
   back, and Back returns to the document they came from. No framework, no fetch: every
   document is already in the HTML, which is also what makes the page printable offline.

   Nothing is hidden in the markup: without this file the page is all four documents, in order,
   as one long legal text. Hiding three of them is the enhancement, not the default — a legal
   page that renders blank when a script fails is the one failure this page cannot have. */
(() => {
  const docs = [...document.querySelectorAll('[data-doc]')];
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const row = document.querySelector('.doc-tabs-row');
  const valid = new Set(tabs.map(t => t.dataset.tab));
  const requested = () => {
    const key = new URLSearchParams(location.search).get('document');
    return valid.has(key) ? key : 'terms';
  };
  const show = (key, push, instant) => {
    docs.forEach(d => { d.hidden = d.dataset.doc !== key; });
    tabs.forEach(t => t.setAttribute('aria-current', t.dataset.tab === key ? 'page' : 'false'));
    const tab = tabs.find(t => t.dataset.tab === key);
    document.title = tab.textContent + ' — TrustForex';
    // On a phone the links scroll sideways; centre the open one so Cookie Settings is not off-screen.
    const a = tab.getBoundingClientRect(), r = row.getBoundingClientRect();
    row.scrollLeft += a.left + a.width / 2 - (r.left + r.width / 2);
    if (!push) return;
    const url = new URL(location.href);
    url.searchParams.set('document', key);
    url.hash = '';
    history.pushState({ document: key }, '', url);
    window.scrollTo({ top: 0, behavior: instant ? 'instant' : 'smooth' });
  };
  // The footer's legal column carries the same ?document= links; they switch in place too, and land
  // at the top at once, as every footer link does — a glide up a whole document stops wherever a touch catches it.
  document.querySelectorAll('a[href^="?document="]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    show(new URLSearchParams(a.getAttribute('href')).get('document'), true, !!a.closest('footer'));
  }));
  addEventListener('popstate', () => show(requested(), false));
  show(requested(), false);
})();
