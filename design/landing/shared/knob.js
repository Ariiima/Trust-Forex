/* One sliding knob for every picker on the site.

   A picker used to blink: the old option dropped its fill and the new one took it in the same frame.
   Here the pick is one box that travels between the options on a damped spring, so the eye follows the
   choice instead of re-finding it. cb8's calculator and the partnership form each grew their own copy
   of this first (cb8/main.js, partnership/page.js); this is that code written once, for the pickers on
   results and referral (founder, 2026-09-18).

   tfKnob(track, items, opts) — track is the positioned parent, items are the options in order.
     opts.className  the knob's own class; each page draws it, this file only moves it
     opts.pressed    (item) => boolean, defaults to aria-pressed="true"
     opts.duration   ms, 880 by default
     opts.spring     'soft' (default, lands without overshoot) or 'tight' — the cashback calculator's
                     own curve, about 1.5% overshoot, for a bar that should snap rather than glide
     opts.ink        (item) => ({ '--x': 'value' }), custom properties written on the knob per pick,
                     so a registered @property can blend one option's colour into the next
   Returns { move(item, animate), layout(), knob }.

   The knob takes the option's own box (offsetLeft/offsetTop count the track's padding), so a bar that
   wraps to two rows on a phone needs nothing extra. */
(() => {
  const REDUCE = document.documentElement.classList.contains('reduce');
  /* a damped spring sampled into CSS linear(), so Web Animations can run it. Soft is damped to the
     edge (zeta .95) and lands without overshoot — the partnership contact toggle's curve. Tight is
     the cashback calculator's own (zeta .78), which overshoots about 1.5% and reads as quick. */
  const spring = (zeta, w) => {
    const pts = [], n = 60, wd = w * Math.sqrt(1 - zeta * zeta);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push(+(1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t))).toFixed(4));
    }
    return `linear(${pts.join(',')},1)`;
  };
  const SPRINGS = { soft: spring(0.95, 8.5), tight: spring(0.78, 13) };

  window.tfKnob = (track, items, opts = {}) => {
    if (!track || !items || !items.length) return null;
    const knob = document.createElement('span');
    knob.className = opts.className || 'knob-slide';
    knob.setAttribute('aria-hidden', 'true');
    track.prepend(knob);
    track.classList.add('knobbed');

    const isOn = opts.pressed || ((el) => el.getAttribute('aria-pressed') === 'true');
    const frame = (el) => ({
      transform: `translate(${el.offsetLeft}px,${el.offsetTop}px)`,
      width: `${el.offsetWidth}px`, height: `${el.offsetHeight}px`,
    });
    let slide;
    const move = (el, animate) => {
      if (!el) return;
      const from = animate && !REDUCE ? (() => {
        const k = knob.getBoundingClientRect(), t = track.getBoundingClientRect();
        return {
          transform: `translate(${k.left - t.left - track.clientLeft}px,${k.top - t.top - track.clientTop}px)`,
          width: `${k.width}px`, height: `${k.height}px`,
        };
      })() : null;
      slide?.cancel();
      const to = frame(el);
      Object.assign(knob.style, to);
      if (el.dataset.tier || el.dataset.target || el.dataset.timeframe) knob.dataset.on = el.dataset.tier || el.dataset.target || el.dataset.timeframe;
      // custom properties need setProperty; assigning them to style does nothing
      if (opts.ink) Object.entries(opts.ink(el) || {}).forEach(([k, v]) => knob.style.setProperty(k, v));
      if (from) slide = knob.animate([from, to], { duration: opts.duration || 880, easing: SPRINGS[opts.spring] || SPRINGS.soft });
    };
    /* a load, the font landing and a resize place the knob without moving it */
    const layout = () => {
      const el = items.find(isOn);
      if (!el) return;
      knob.style.transition = 'none';
      move(el, false);
      void knob.offsetWidth;
      knob.style.transition = '';
    };
    layout();
    document.fonts.ready.then(layout);
    new ResizeObserver(layout).observe(track);
    return { move, layout, knob };
  };
})();
