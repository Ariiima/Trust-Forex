/* Broker Partnership — what this page does beyond cb8/main.js (reveal, holds, icons, FAQ, to-top):
   the access-condition switch on 02, the contact toggle on the form, and the request itself. */
(() => {
  /* ---------- 02 · the access rule: the wireframe's two modes, a spring knob and rolling words ---------- */
  const MODES = {
    immediate: { title: 'Unlock when the client joins', steps: ['Client selected', 'Campaign opened', 'Access unlocked'] },
    funded: { title: 'Unlock after funding confirmation', steps: ['Account linked', 'Funding confirmed', 'Access unlocked'] },
  };
  const REDUCE = document.documentElement.classList.contains('reduce');
  const IOS = 'cubic-bezier(.32,.72,0,1)';
  /* a damped spring (about 1.5% overshoot) sampled into CSS linear(), so Web Animations can run it */
  const SPRING = (() => {
    const pts = [], n = 60, zeta = 0.78, w = 13, wd = w * Math.sqrt(1 - zeta * zeta);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push(+(1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t))).toFixed(4));
    }
    return `linear(${pts.join(',')},1)`;
  })();

  const switches = [...document.querySelectorAll('[data-access]')];
  const knob = document.querySelector('.access-switch .knob');
  const track = knob.parentElement;
  const pressed = () => switches.find((b) => b.getAttribute('aria-pressed') === 'true');

  /* the navy copy of the labels, laid over each button's own box and clipped to wherever the knob is */
  const lit = document.createElement('span');
  lit.className = 'lit'; lit.setAttribute('aria-hidden', 'true');
  const litLabels = switches.map((b) => { const s = document.createElement('span'); s.textContent = b.textContent; lit.append(s); return s; });
  track.append(lit);

  /* the knob takes the pressed button's own box (offsetLeft/offsetTop count the track's padding), so it
     works stacked (mobile) the same way; the clip is the same box written as insets of the track */
  const boxOf = (b) => ({ x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight });
  const knobFrame = (r) => ({ transform: `translate(${r.x}px,${r.y}px)`, width: `${r.w}px`, height: `${r.h}px` });
  const clipFrame = (r) => ({ clipPath: `inset(${r.y}px ${track.clientWidth - r.x - r.w}px ${track.clientHeight - r.y - r.h}px ${r.x}px round 10px)` });
  const knobNow = () => {
    const k = knob.getBoundingClientRect(), t = track.getBoundingClientRect();
    return { x: k.left - t.left - track.clientLeft, y: k.top - t.top - track.clientTop, w: k.width, h: k.height };
  };
  let slides = [];
  const placeKnob = (to, from) => {
    slides.forEach((a) => a.cancel()); slides = [];
    Object.assign(knob.style, knobFrame(to)); Object.assign(lit.style, clipFrame(to));
    if (!from || REDUCE) return;
    const opts = { duration: 700, easing: SPRING };
    slides = [knob.animate([knobFrame(from), knobFrame(to)], opts), lit.animate([clipFrame(from), clipFrame(to)], opts)];
  };
  /* a load (and the font landing, and a resize) places everything without animating */
  const layout = () => {
    switches.forEach((b, i) => Object.assign(litLabels[i].style, { left: `${b.offsetLeft}px`, top: `${b.offsetTop}px`, width: `${b.offsetWidth}px`, height: `${b.offsetHeight}px` }));
    placeKnob(boxOf(pressed()));
  };

  /* each label's text becomes one line in a clipping roll; a switch rolls the old line up and out
     while the new one rolls up in, 40ms a label, the rule line last */
  const title = document.getElementById('access-title');
  const steps = [...document.querySelectorAll('.access-step')];
  const rolls = [title, ...steps.map((s) => s.querySelector('span'))]
    .map((el) => {
      const line = document.createElement('span'); line.textContent = el.textContent;
      const roll = document.createElement('span'); roll.className = 'access-roll'; roll.append(line);
      el.textContent = ''; el.append(roll);
      return roll;
    });
  const [titleRoll, ...stepRolls] = rolls;
  const rollTo = (roll, text, delay) => {
    [...roll.children].slice(0, -1).forEach((c) => c.remove());
    const old = roll.lastElementChild;
    if (old.textContent === text) return;   /* "Access unlocked" is the same in both modes */
    const line = document.createElement('span'); line.textContent = text;
    if (REDUCE) { old.replaceWith(line); return; }
    roll.append(line);
    const opts = { duration: 520, easing: IOS, delay, fill: 'both' };
    old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-105%)', opacity: 0 }], opts)
      .finished.then(() => old.remove(), () => {});
    line.animate([{ transform: 'translateY(105%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], opts)
      .finished.then((a) => a.cancel(), () => {});
  };

  switches.forEach((b) => b.addEventListener('click', () => {
    if (b === pressed()) return;
    const from = knobNow();
    switches.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    placeKnob(boxOf(b), from);
    const m = MODES[b.dataset.access];
    stepRolls.forEach((r, i) => rollTo(r, m.steps[i], i * 40));
    rollTo(titleRoll, m.title, 120);
  }));
  /* the track, not the window: the phone's stacked buttons widen with the panel after load (the page's
     hold/plain mode settling), and a window resize never fires for that */
  layout();
  document.fonts.ready.then(layout);
  new ResizeObserver(layout).observe(track);

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
