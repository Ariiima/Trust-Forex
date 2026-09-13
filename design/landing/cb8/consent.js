/* Cookie consent for every landing page: the banner on a first visit, the preferences dialog, and
   the gate that holds optional scripts back until their category is allowed.

   It is the pattern most sites use, and the one the Cookie Settings document promises (founder,
   2026-09-13: "see what's common and expected … we should do the same"). Strictly necessary
   cookies need no consent. Analytics and marketing stay off until the visitor chooses. "Reject all"
   sits beside "Accept all", one click and the same size. The choice can be changed at any time from
   the end of the Cookie Settings tab. It is kept in one first-party cookie for six months, and then
   the banner asks again. It also asks again when VERSION goes up: raise it when a new tool arrives
   that an earlier choice did not cover.

   Adding a tool: list it under its category in CATEGORIES (the dialog shows that list), and load it as
       <script type="text/plain" data-consent="analytics" src="…"></script>
   so the browser does not run it. This file swaps it for a live script once analytics is allowed.
   A script that has run cannot be taken back, so withdrawing its category reloads the page.
   Today no optional tool is in use: both optional lists are empty and the gate holds nothing.

   The banner and the dialog are built here, not written into each page, so the nine pages and the
   blog's generated ones cannot drift. Without JS there is no banner, and nothing optional runs. */
(() => {
  const VERSION = 1;
  const NAME = 'tf_consent';
  const MAX_AGE = 182 * 24 * 60 * 60;   // six months, in seconds
  const CATEGORIES = [
    { id: 'necessary', title: 'Strictly necessary', locked: true,
      text: 'Keep the site working and secure, and remember the choice you make here. They cannot be switched off.',
      tools: [{ name: NAME, provider: 'TrustForex', purpose: 'Remembers your cookie choices', duration: '6 months' }] },
    { id: 'analytics', title: 'Analytics',
      text: 'Count visits and show which pages are read, so the site can be improved.', tools: [] },
    { id: 'marketing', title: 'Marketing',
      text: 'Measure which ads and partner campaigns bring visitors to TrustForex.', tools: [] },
  ];
  const OPTIONAL = CATEGORIES.filter(c => !c.locked);
  const POLICY = new URL('../legal/?document=cookies', document.currentScript.src).href;

  const read = () => {
    const raw = document.cookie.split('; ').find(c => c.startsWith(NAME + '='));
    const p = new URLSearchParams(decodeURIComponent(raw ? raw.slice(NAME.length + 1) : ''));
    if (p.get('v') !== String(VERSION)) return null;
    return Object.fromEntries([['at', +p.get('at')], ...OPTIONAL.map(c => [c.id, p.get(c.id) === '1'])]);
  };
  let choice = read();

  // Swap every held script whose category is now allowed for a live copy of it.
  const ran = new Set();
  const release = () => document.querySelectorAll('script[type="text/plain"][data-consent]').forEach(held => {
    if (!choice?.[held.dataset.consent]) return;
    const live = document.createElement('script');
    for (const a of held.attributes) if (a.name !== 'type') live.setAttribute(a.name, a.value);
    live.text = held.text;
    held.replaceWith(live);
    ran.add(held.dataset.consent);
  });

  const banner = document.createElement('section');
  banner.className = 'cc-banner';
  banner.setAttribute('aria-label', 'Cookie choices');
  banner.innerHTML = `<p class="cc-title">Cookies on TrustForex</p>
<p class="cc-text">Essential cookies keep this site running. With your permission we would also use analytics and marketing cookies. <a href="${POLICY}">Cookie Settings</a></p>
<div class="cc-actions">
  <button type="button" class="btn" data-cc="reject">Reject all</button>
  <button type="button" class="btn" data-cc="accept">Accept all</button>
  <button type="button" class="cc-link" data-cc="manage">Manage preferences</button>
</div>`;

  const dialog = document.createElement('dialog');
  dialog.className = 'cc-dialog';
  dialog.setAttribute('aria-labelledby', 'cc-dialog-title');
  dialog.innerHTML = `<div class="cc-form">
<button type="button" class="cc-close" data-cc="close" aria-label="Close"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
<p class="cc-title" id="cc-dialog-title">Cookie preferences</p>
<p class="cc-text">Choose which cookies TrustForex may use. You can change this at any time from Cookie Settings, linked at the foot of every page.</p>
${CATEGORIES.map(c => `<div class="cc-cat">
  <div class="cc-cat-head">${c.locked
    ? `<span class="cc-cat-title">${c.title}</span><span class="cc-always">Always on</span>`
    : `<label class="cc-cat-title" for="cc-${c.id}">${c.title}</label><input type="checkbox" role="switch" class="cc-switch" id="cc-${c.id}">`}</div>
  <p class="cc-text">${c.text}</p>
  <ul class="cc-tools">${c.tools.length
    ? c.tools.map(t => `<li><b>${t.name}</b> · ${t.provider} · ${t.purpose} · ${t.duration}</li>`).join('')
    : '<li>None in use.</li>'}</ul>
</div>`).join('')}
<div class="cc-actions">
  <button type="button" class="btn" data-cc="reject">Reject all</button>
  <button type="button" class="btn" data-cc="accept">Accept all</button>
  <button type="button" class="btn btn-solid" data-cc="save">Save choices</button>
</div>
</div>`;

  const status = () => document.querySelectorAll('[data-consent-status]').forEach(el => {
    el.textContent = choice
      ? `Your choice: ${OPTIONAL.map(c => `${c.title} ${choice[c.id] ? 'on' : 'off'}`).join(', ')}. Saved ${
        new Date(choice.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
      : 'No choice made yet, so analytics and marketing are off.';
  });

  const save = next => {
    const withdrawn = [...ran].some(id => !next[id]);
    choice = { ...next, at: Date.now() };
    const p = new URLSearchParams({ v: VERSION, ...Object.fromEntries(OPTIONAL.map(c => [c.id, next[c.id] ? 1 : 0])), at: choice.at });
    document.cookie = `${NAME}=${encodeURIComponent(p)}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    if (withdrawn) return location.reload();   // a script that has run cannot be unloaded
    if (dialog.open) dialog.close();
    banner.remove();
    release();
    status();
    dispatchEvent(new CustomEvent('tf:consent', { detail: choice }));
  };
  const every = on => Object.fromEntries(OPTIONAL.map(c => [c.id, on]));
  const open = () => {
    OPTIONAL.forEach(c => { dialog.querySelector('#cc-' + c.id).checked = !!choice?.[c.id]; });
    dialog.showModal();
  };

  addEventListener('click', e => {
    if (e.target.closest('[data-consent-open]')) return open();
    const act = e.target.closest('[data-cc]')?.dataset.cc;
    if (act === 'manage') open();
    else if (act === 'close') dialog.close();
    else if (act === 'reject' || act === 'accept') save(every(act === 'accept'));
    else if (act === 'save') save(Object.fromEntries(OPTIONAL.map(c => [c.id, dialog.querySelector('#cc-' + c.id).checked])));
  });
  // The dialog box is padding-free, so a click that lands on it and not its content is on the backdrop.
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  // After parsing, so a held script written below this file's tag is found too.
  const start = () => {
    document.body.append(dialog);
    if (!choice) document.body.append(banner);
    document.querySelectorAll('[data-consent-open]').forEach(el => el.closest('[hidden]')?.removeAttribute('hidden'));
    release();
    status();
  };
  window.tfConsent = { allowed: id => !!choice?.[id], open };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start();
})();
