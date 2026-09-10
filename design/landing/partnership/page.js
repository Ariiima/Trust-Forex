/* Broker Partnership — what this page does beyond cb8/main.js (reveal, holds, icons, FAQ, to-top):
   the access-condition switch on 02, the contact toggle on the form, and the request itself. */
(() => {
  /* ---------- 02 · the access rule: the wireframe's two modes, swapped with a cross-fade ---------- */
  const MODES = {
    immediate: { title: 'Unlock when the client joins', steps: ['Client selected', 'Campaign opened', 'Access unlocked'] },
    funded: { title: 'Unlock after funding confirmation', steps: ['Account linked', 'Funding confirmed', 'Access unlocked'] },
  };
  const swap = (el) => { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); };
  const title = document.getElementById('access-title');
  const steps = [...document.querySelectorAll('.access-step')];
  const switches = [...document.querySelectorAll('[data-access]')];
  switches.forEach((b) => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    switches.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    const m = MODES[b.dataset.access];
    title.textContent = m.title; swap(title);
    steps.forEach((s, i) => { s.querySelector('span').textContent = m.steps[i]; swap(s); });
  }));

  /* ---------- the form: Telegram or WhatsApp decides what the contact field asks for ---------- */
  const label = document.getElementById('contact-label');
  const contact = document.getElementById('contact-input');
  document.querySelectorAll('input[name="contact"]').forEach((r) => r.addEventListener('change', () => {
    const wa = r.value === 'whatsapp';
    label.textContent = wa ? 'WhatsApp Number' : 'Telegram ID';
    contact.placeholder = wa ? '+00 000 000 0000' : '@username';
    contact.type = wa ? 'tel' : 'text';
  }));

  /* ---------- the request: JSON to the API as text/plain (no preflight), the card flips to "received" ----------
     The API is the Mini App's host, not this one — the landing site is static. */
  const API = 'https://app.trustforex.net/api/partnership';
  const form = document.getElementById('partnership-form');
  const card = document.getElementById('form-card');
  const error = document.getElementById('form-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = Object.fromEntries(fd);
    body.goals = fd.getAll('goal'); delete body.goal;
    const btn = form.querySelector('.send');
    btn.disabled = true; error.hidden = true;
    try {
      const r = await fetch(API, { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw new Error(String(r.status));
      card.classList.add('sent');
      card.querySelector('.form-success .ico')?.dispatchEvent(new Event('pointerenter'));   // main.js plays the tick
    } catch {
      error.textContent = 'The request could not be sent. Please try again, or contact us on Telegram.';
      error.hidden = false; btn.disabled = false;
    }
  });
})();
