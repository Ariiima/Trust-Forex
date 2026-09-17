/* A figure that rolls instead of blinking — the cashback calculator's estimate motion, written once.

   The old number leaves as the new one arrives, upward when the value rises and downward when it
   falls, and the roll's width eases between the two so whatever follows it glides instead of jumping
   (cb8/main.js, founder 2026-09-16: "make the number change smoother"). Never a count-up.

   tfRoll(el, opts) — el holds the figure and nothing else; its text becomes the first line.
     opts.duration  ms, 520 by default
     opts.className the roll wrapper's class, 'tf-roll' by default; each page draws it
   Returns { set(text), el } — set() is a no-op when the text has not changed. */
(() => {
  const REDUCE = document.documentElement.classList.contains('reduce');
  const IOS = 'cubic-bezier(.32,.72,0,1)';

  window.tfRoll = (el, opts = {}) => {
    if (!el) return null;
    const roll = document.createElement('span');
    roll.className = opts.className || 'tf-roll';
    const first = document.createElement('span');
    first.textContent = el.textContent.trim();
    roll.append(first);
    el.replaceChildren(roll);

    let widthAnim;
    const set = (text) => {
      [...roll.children].slice(0, -1).forEach((c) => c.remove());   // a change mid-roll drops the stale line
      const old = roll.lastElementChild;
      if (old.textContent === text) return;
      const line = document.createElement('span');
      line.textContent = text;
      if (REDUCE) { roll.getAnimations({ subtree: true }).forEach((a) => a.cancel()); roll.replaceChildren(line); return; }
      const w0 = roll.getBoundingClientRect().width;
      widthAnim?.cancel();
      old.setAttribute('aria-hidden', 'true');
      roll.append(line);
      const w1 = line.getBoundingClientRect().width;
      const num = (s) => parseFloat(s.replace(/[^\d.]/g, ''));
      const dir = num(text) < num(old.textContent) ? -1 : 1;
      const o = { duration: opts.duration || 520, easing: IOS, fill: 'both' };
      old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-105 * dir}%)`, opacity: 0 }], o)
        .finished.then(() => old.remove(), () => {});
      line.animate([{ transform: `translateY(${105 * dir}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], o)
        .finished.then((a) => a.cancel(), () => {});
      widthAnim = roll.animate([{ width: `${w0}px` }, { width: `${w1}px` }], o);
      widthAnim.finished.then(() => { old.remove(); widthAnim.cancel(); }, () => {});
    };
    return { set, el };
  };
})();
