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
    label.textContent = wa ? 'WhatsApp number' : 'Telegram ID';
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

  /* ---------- self-check: ?check=1 ----------
     The page ships one access mode, one contact method and six goals already written into the markup,
     so a reader without JavaScript still sees a finished card and a working form. Each of those is
     also written as a rule — MODES here, GOALS and REQUIRED in server/partnership.mjs, copied below —
     and this proves the two still agree. A goal value renamed on one side only is a lead's answer
     dropped in silence: the API keeps the six values it knows and discards the rest. */
  if (new URLSearchParams(location.search).get('check') === '1') {
    const fails = [];
    const on = switches.filter((b) => b.getAttribute('aria-pressed') === 'true');
    if (on.length !== 1) fails.push(`${on.length} access modes are pressed, exactly 1 must be`);
    else {
      const k = on[0].dataset.access, m = MODES[k];
      if (!m) fails.push(`the pressed button asks for "${k}", which is not a mode`);
      else {
        if (title.textContent.trim() !== m.title) fails.push(`shipped rule "${title.textContent.trim()}" != ${k}'s "${m.title}"`);
        if (steps.length !== m.steps.length) fails.push(`${steps.length} access steps, ${k} writes ${m.steps.length}`);
        steps.forEach((s, i) => {
          const had = s.querySelector('span').textContent.trim();
          if (had !== m.steps[i]) fails.push(`step ${i + 1} reads "${had}", ${k} says "${m.steps[i]}"`);
        });
      }
    }
    const done = steps.filter((s) => s.classList.contains('done'));
    if (done.length !== 1 || done[0] !== steps.at(-1)) fails.push('the unlocked mark belongs on the last step, and only there');

    const wa = document.querySelector('input[name="contact"]:checked')?.value === 'whatsapp';
    if (label.textContent.trim() !== (wa ? 'WhatsApp number' : 'Telegram ID')) fails.push(`contact label reads "${label.textContent.trim()}", the checked method asks for another`);
    if (contact.placeholder !== (wa ? '+00 000 000 0000' : '@username')) fails.push(`contact placeholder "${contact.placeholder}" is not the checked method's`);

    const REQUIRED = ['name', 'broker', 'website', 'email', 'contact_detail'];   // server/partnership.mjs
    REQUIRED.forEach((n) => {
      const f = form.elements[n];
      if (!f) fails.push(`the API requires "${n}" and the form has no such field`);
      else if (!f.required) fails.push(`"${n}" is required by the API and optional on the form`);
    });
    const GOALS = {                                                             // server/partnership.mjs
      reactivate: 'Reactivate inactive clients', funded: 'Encourage account funding',
      vip: 'Reward active or VIP clients', retention: 'Strengthen client retention',
      campaign: 'Promote a broker campaign', custom: 'Explore a custom partnership',
    };
    const boxes = [...form.querySelectorAll('input[name="goal"]')];
    if (boxes.length !== Object.keys(GOALS).length) fails.push(`${boxes.length} goal boxes, the API files ${Object.keys(GOALS).length}`);
    boxes.forEach((b) => {
      if (!(b.value in GOALS)) { fails.push(`goal "${b.value}" is not one the API accepts — it would be dropped`); return; }
      const had = b.nextElementSibling.textContent.trim();
      if (had !== GOALS[b.value]) fails.push(`goal "${b.value}" reads "${had}", the API files it as "${GOALS[b.value]}"`);
    });
    if (!form.elements.company) fails.push('the honeypot field is gone, and it is the whole spam defence');

    console.log(fails.length ? 'PARTNERSHIP CHECK FAIL\n' + fails.join('\n')
      : `PARTNERSHIP CHECK OK — ${on[0].dataset.access} access, ${boxes.length} goals, ${REQUIRED.length} required fields`);
  }
})();
