import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Roll a figure from `from` to `to`.
 *
 * Deliberately *not* a general-purpose animated number: it runs on mount and on
 * a genuine change of `to`, never on an unrelated re-render, so a balance does
 * not re-roll every time a sibling piece of state moves.
 *
 * Returns the live value; format it at the call site (these figures are
 * variously "$245.00", "12", "+3").
 */
export function useCountUpFrom(from: number, to: number, ms = 900): number {
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? to : from);
  const at = useRef(from);

  useEffect(() => {
    if (still || at.current === to) {
      at.current = to;
      setShown(to);
      return;
    }
    const start = performance.now();
    const a = at.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // ease-out cubic: fast first, so the figure is readable almost at once
      setShown(a + (to - a) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else at.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, still]);

  return shown;
}

/** Roll up from zero — for a figure with no meaningful previous value. */
export function useCountUp(value: number, ms = 900): number {
  return useCountUpFrom(0, value, ms);
}

/**
 * A figure that rolls up from whatever it was the last time this device saw the
 * screen, and reports the increment so it can be shown — once.
 *
 * The baseline is per-device (localStorage), which is the right scope for a
 * "what changed since you last looked" affordance: it should reset on a new
 * device rather than follow the account around. The server flags API next door
 * stores booleans only, so it could not hold a running figure anyway.
 *
 * A first-ever visit reports no increment. Baselining at 0 instead would greet
 * a brand-new user with a fabricated "+42 invited users" they never earned.
 *
 * The baseline is rewritten on mount, so an increment survives exactly one
 * viewing — come back without the number having changed and there is nothing
 * to show.
 */
export function useSeenValue(
  key: string,
  value: number,
): { shown: number; delta: number; firstVisit: boolean } {
  const [{ baseline, firstVisit }] = useState(() => {
    try {
      const raw = localStorage.getItem(`tf-seen:${key}`);
      return raw === null
        ? { baseline: value, firstVisit: true }
        : { baseline: Number(raw) || 0, firstVisit: false };
    } catch {
      // private mode / storage disabled — behave as "already seen"
      return { baseline: value, firstVisit: false };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`tf-seen:${key}`, String(value));
    } catch {
      /* nothing to do — the increment just shows again next time */
    }
  }, [key, value]);

  return {
    shown: useCountUpFrom(baseline, value),
    delta: Math.max(0, value - baseline),
    firstVisit,
  };
}

/**
 * Telegram's haptics, safely.
 *
 * The API is missing on the web preview and on WebView versions below 6.1,
 * where touching it can throw rather than no-op — hence the guard and the
 * catch. `selection` is the light tick meant for a value scrubbing past steps.
 * Without a Telegram client we fall back to the Vibration API, so scrubbing
 * still ticks in the browser preview and on Telegram Web/Desktop on Android.
 * iOS outside Telegram has neither — nothing to fall back to there.
 */
export function haptic(kind: 'selection' | 'light' | 'rigid' = 'selection'): void {
  const h = window.Telegram?.WebApp?.HapticFeedback;
  try {
    if (!h) {
      navigator.vibrate?.(kind === 'selection' ? 8 : 15);
    } else if (kind === 'selection') {
      h.selectionChanged?.();
    } else {
      h.impactOccurred?.(kind);
    }
  } catch {
    /* unsupported WebView version — haptics are a bonus, never a requirement */
  }
}
