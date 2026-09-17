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
  const methods = [...document.querySelectorAll('input[name="contact"]')];
  methods.forEach((r) => r.addEventListener('change', () => {
    const wa = r.value === 'whatsapp';
    rollLabel(wa ? 'WhatsApp number' : 'Telegram ID');
    swapPlaceholder(wa ? '+00 000 000 0000' : '@username', wa ? 'tel' : 'text');
    placeMethod(r, true);
  }));

  /* the label rolls its words the way the cashback calculator rolls its estimate — the same
     shared/roll.js the referral figures use, so one motion covers every changing line on the site
     (founder, 2026-09-18: "make the text change to look like cashback as well"). The placeholder
     under it dips out and back, so neither text cuts mid-slide. */
  const labelRoll = window.tfRoll?.(label) || null;
  const rollLabel = (text) => { if (labelRoll) labelRoll.set(text); else label.textContent = text; };
  /* The placeholder rolls too (founder, 2026-09-18: "the placeholder text doesn't change smoothly
     like the title"). A real ::placeholder cannot be animated, so the field carries a ghost line of
     its own — the same shared/roll.js the label above it uses — and the native one is painted
     transparent while that ghost is up. The attribute still tracks the method, so a reader, an
     autofill and a page without the script all still see the right prompt. The ghost hides the
     moment anything is typed, exactly as a placeholder does. */
  const line = document.createElement('span');
  line.className = 'field-line';
  contact.parentNode.insertBefore(line, contact);
  line.append(contact);
  const ghost = document.createElement('span');
  ghost.className = 'field-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = contact.placeholder;
  line.append(ghost);
  contact.classList.add('ghosted');
  const ghostRoll = window.tfRoll?.(ghost) || null;
  const showGhost = () => line.classList.toggle('filled', !!contact.value);
  contact.addEventListener('input', showGhost);
  showGhost();

  const swapPlaceholder = (text, type) => {
    contact.placeholder = text;
    contact.type = type;
    if (ghostRoll) ghostRoll.set(text); else ghost.textContent = text;
  };

  /* the checked method's fill is one knob sliding across, on the same spring as 02's switch and the
     cashback calculator's level knob (founder, 2026-09-17). The knob takes the pill's own box, so the
     phone's stacked bar needs nothing extra; page.css blends its colours from one method to the next. */
  /* the cashback calculator's spring (zeta .78, about 1.5% overshoot), run over 900ms — the beat the
     referral rail and the results bars settled on, held a little longer here because these two pills
     are the widest pair on the site (founder, 2026-09-18: "make partnership slower") */
  const SOFT = (() => {
    const pts = [], n = 60, zeta = 0.78, w = 13, wd = w * Math.sqrt(1 - zeta * zeta);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push(+(1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t))).toFixed(4));
    }
    return `linear(${pts.join(',')},1)`;
  })();
  /* the knob's metal per method, written here as well as in page.css, so the colour never rests on an
     attribute selector or a var() hop (founder, 2026-09-18: "whatsapp button isn't green") */
  const INK = {
    telegram: { '--c-tint': 'rgba(100,181,246,.72)', '--c-tint2': 'rgba(100,181,246,.34)', '--c-glow': 'rgba(100,181,246,.65)' },
    whatsapp: { '--c-tint': 'rgba(110,224,158,.78)', '--c-tint2': 'rgba(110,224,158,.36)', '--c-glow': 'rgba(110,224,158,.6)' },
  };
  const toggle = document.querySelector('.contact-toggle');
  let mKnob, mSlide;
  if (toggle && methods.length) {
    mKnob = document.createElement('span');
    mKnob.className = 'contact-knob'; mKnob.setAttribute('aria-hidden', 'true');
    toggle.prepend(mKnob); toggle.classList.add('knobbed');
  }
  /* the box is the label's, not the pill's: the pill sits inside a position:relative label, so its own
     offsetLeft/offsetTop are 0 and the knob would never leave the first method */
  const pillOf = (r) => r.parentElement;
  const mFrame = (el) => ({ transform: `translate(${el.offsetLeft}px,${el.offsetTop}px)`, width: `${el.offsetWidth}px`, height: `${el.offsetHeight}px` });
  const placeMethod = (r, animate) => {
    if (!mKnob || !r) return;
    const el = pillOf(r);
    const from = animate && !REDUCE ? (() => {
      const k = mKnob.getBoundingClientRect(), t = toggle.getBoundingClientRect();
      return { transform: `translate(${k.left - t.left - toggle.clientLeft}px,${k.top - t.top - toggle.clientTop}px)`, width: `${k.width}px`, height: `${k.height}px` };
    })() : null;
    mSlide?.cancel();
    const to = mFrame(el);
    Object.assign(mKnob.style, to);
    mKnob.dataset.method = r.value;
    Object.entries(INK[r.value] || INK.telegram).forEach(([k, v]) => mKnob.style.setProperty(k, v));   // custom properties need setProperty, not assignment
    if (from) mSlide = mKnob.animate([from, to], { duration: 900, easing: SOFT });
  };
  if (mKnob) {
    /* a load, the font landing and a resize place the knob without moving it */
    const mLayout = () => placeMethod(methods.find((r) => r.checked), false);
    mKnob.style.transition = 'none'; mLayout(); void mKnob.offsetWidth; mKnob.style.transition = '';
    document.fonts.ready.then(mLayout);
    new ResizeObserver(mLayout).observe(toggle);
  }

  /* ---------- the request: JSON to the API as text/plain (no preflight), the card flips to "received" ----------
     The API is the Mini App's host, not this one — the landing site is static. */
  const API = 'https://app.trustforex.net/api/partnership';
  const form = document.getElementById('partnership-form');
  const card = document.getElementById('form-card');
  const error = document.getElementById('form-error');
  /* The form answers for itself: the browser's bubble is a grey box with a red dot that belongs to
     no page, so index.html carries novalidate and the checks run here. A field that fails gets a
     warm rim and a line of its own under it; the first one takes focus. Nothing is marked while a
     visitor types — a mark clears on the next keystroke in that field (founder, 2026-09-18). */
  const checked = [...form.querySelectorAll('input[required], textarea[required], input[type=email], input[type=url]')];
  const noteFor = (field) => {
    const well = field.closest('.well');
    let note = well.querySelector('.field-note');
    if (!note) {
      note = document.createElement('span');
      note.className = 'field-note';
      note.id = `${field.id}-note`;
      const clip = document.createElement('span');   // the inner line is what the opening row clips
      const tag = document.createElement('span');
      tag.className = 'tag';
      clip.append(tag);
      note.append(clip);
      well.append(note);
    }
    return note;
  };
  const says = (field) => {
    if (field.validity.valueMissing) return 'Please fill this in';
    if (field.validity.typeMismatch && field.type === 'email') return 'Check this email address';
    if (field.validity.typeMismatch && field.type === 'url') return 'Start the link with https://';
    return field.validationMessage;
  };
  const clearField = (field) => {
    const well = field.closest('.well');
    well.classList.remove('invalid', 'flagging');
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
  };
  /* only the field being travelled to swells its ring. Five ring animations at once are five
     box-shadow spreads over five backdrop-filtered wells, and the page cannot repaint that and
     scroll at the same time (founder, 2026-09-18: "the scroll isn't smooth at all"). */
  const markField = (field) => {
    const note = noteFor(field);
    const well = field.closest('.well');
    note.querySelector('.tag').textContent = says(field);
    well.classList.add('invalid');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', note.id);
  };
  /* and it swells on arrival, not on departure: the ring is a .9s box-shadow spread — a paint on
     every frame of it — and it used to start the moment Send was pressed, so its last half second
     ran underneath the travel. The ring says "here it is", which is a thing to say once the field
     is on screen anyway (founder, 2026-09-18: "the scroll is slow and laggy"). */
  const ringField = (field) => {
    const well = field.closest('.well');
    if (!well || REDUCE) return;
    well.classList.remove('flagging'); void well.offsetWidth; well.classList.add('flagging');
  };
  /* The plate stays for one thing only: a request the API would not take. A missed field says so at
     the field itself — a second notice above the button repeated it, and opening it pushed the whole
     form down (founder, 2026-09-18: "i don't like this in the image and it's way too jumpy"). */
  const errorText = document.getElementById('form-error-text');
  const errorRoll = window.tfRoll?.(errorText) || null;
  const sayError = (text) => { if (errorRoll) errorRoll.set(text); else errorText.textContent = text; };
  let plate;
  const showError = (text) => {
    const first = error.hidden;
    sayError(text);
    error.hidden = false;
    if (first && !REDUCE) {
      plate?.cancel();
      plate = error.animate([{ opacity: 0, transform: 'translateY(-7px)' }, { opacity: 1, transform: 'none' }],
        { duration: 340, easing: IOS });
    }
    error.querySelector('.ico')?.dispatchEvent(new Event('pointerenter'));   // main.js plays the mark
  };
  const hideError = () => {
    if (error.hidden) return;
    if (REDUCE) { error.hidden = true; return; }
    plate?.cancel();
    plate = error.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-7px)' }],
      { duration: 220, easing: IOS });
    plate.finished.then(() => { error.hidden = true; plate.cancel(); }, () => {});
  };
  /* The first unanswered field is travelled to, and only when it is actually off screen. The browser's
     own smooth scroll re-reads its target every frame, so the tags opening under five wells kept
     moving the ground under it — and its duration grows with the distance, which on a page of
     backdrop-filtered glass is where the stutter came from. This glides on one target measured once,
     over a fixed beat, after the tags have finished opening (founder, 2026-09-18). */
  /* the walk stops short of <body> and <html>: the page itself scrolls through the window, and the
     root element answers this test too — auto overflow, a scrollHeight taller than its box. Taken
     for the scroller it reports its own height for the viewport and a rect top of minus the scroll
     position, which puts the target thousands of pixels past the end and the travel went the wrong
     way, to the foot of the page (founder, 2026-09-18). */
  const scrollerOf = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return window;
  };
  const EASE = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // the page's own in-out cubic
  const BEAT = 440;
  const root = document.documentElement;
  let glide;
  const travelTo = (el, done = () => {}) => {
    const sc = scrollerOf(el);
    const box = el.getBoundingClientRect();
    const view = sc === window ? innerHeight : sc.getBoundingClientRect().height;
    const top = sc === window ? scrollY : sc.scrollTop;
    const frame = sc === window ? 0 : sc.getBoundingClientRect().top;
    const want = Math.max(0, top + box.top - frame - (view - box.height) / 2);
    const max = sc === window ? document.documentElement.scrollHeight - innerHeight : sc.scrollHeight - sc.clientHeight;
    const to = Math.min(want, Math.max(0, max));
    const gap = to - top;
    if (Math.abs(gap) < 40) { done(); return; }            // already where it can be read
    if (REDUCE) { sc.scrollTo(0, to); done(); return; }
    cancelAnimationFrame(glide);
    /* .gliding holds the closing screen's glass still for the length of the travel (page.css) —
       the pane's streak and its thirteen tiles' streaks ride the ground timeline, so every
       scrolled pixel repainted fourteen gradients behind fourteen backdrop blurs. */
    root.classList.add('gliding');
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / BEAT);
      sc.scrollTo(0, top + gap * EASE(k));
      if (k < 1) { glide = requestAnimationFrame(step); return; }
      root.classList.remove('gliding');
      done();
    };
    glide = requestAnimationFrame(step);
  };
  const reveal = (field) => {
    field.focus({ preventScroll: true });
    const well = field.closest('.well') || field;
    const box = well.getBoundingClientRect();
    const sc = scrollerOf(well);
    const view = sc === window ? innerHeight : sc.getBoundingClientRect().height;
    if (box.top >= 8 && box.bottom <= view - 8) { ringField(field); return; }   // on screen: nothing needs to move
    /* A held screen — pinned at the top for the length of its hold — does not move with the page,
       so centring it by its own rect lands nowhere near, and main.js's own travel has to take it.
       That branch used to take every screen, and the request form is not on a held one: it sent the
       travel through the browser's smooth scroll, whose duration grows with the distance, to the top
       of the whole closing screen rather than to the field that was missed (founder, 2026-09-18:
       "the scroll is slow and laggy"). Only a screen actually in a .hold box goes that way now. */
    const screen = well.closest('.screen');
    const held = !!well.closest('.hold') && root.classList.contains('snap');
    const i = screen ? [...document.querySelectorAll('.screen')].indexOf(screen) : -1;
    setTimeout(() => {                                    // let the tags finish opening first
      if (held && window.__go && i >= 0) { window.__go(i); setTimeout(() => ringField(field), BEAT); }
      else travelTo(well, () => ringField(field));
    }, 380);
  };
  checked.forEach((field) => field.addEventListener('input', () => {
    if (!field.closest('.well').classList.contains('invalid') || !field.checkValidity()) return;
    clearField(field);
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = checked.filter((field) => !field.checkValidity());
    checked.filter((field) => field.checkValidity()).forEach(clearField);
    if (bad.length) { bad.forEach(markField); reveal(bad[0]); return; }
    hideError();
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
      showError('The request could not be sent. Please try again, or contact us on Telegram.');
      btn.disabled = false;
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
    /* the knob must sit on the checked pill, and wear that method's colour */
    const picked = methods.find((r) => r.checked);
    if (!mKnob) fails.push('the contact toggle has no knob');
    else {
      const k = mKnob.getBoundingClientRect(), pill = pillOf(picked).getBoundingClientRect();
      if (Math.abs(k.left - pill.left) > 1 || Math.abs(k.width - pill.width) > 1) fails.push('the contact knob is not on the checked method');
      if (mKnob.dataset.method !== picked.value) fails.push(`the contact knob wears "${mKnob.dataset.method}", the checked method is "${picked.value}"`);
    }

    if (!form.noValidate) fails.push('the form still raises the browser’s own validation bubble');
    if (!error.querySelector('.ico[data-lottie]')) fails.push('the error plate has lost its mark');
    if (!errorRoll) fails.push('the error plate does not roll its line');
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
