import { useEffect, useRef } from 'react';

/* ---------------------------------------------------------------------------
 * Telegram Mini App bindings.
 *
 * The designs model the top bar as a "Telegram header" component instance, so
 * screens do NOT draw their own header — Telegram renders it. That means the
 * back affordance has to come from Telegram's native BackButton, which is what
 * `useBackButton` wires up. Without it, any screen that isn't a nav-bar root
 * has no way back.
 * ------------------------------------------------------------------------- */

export function getTg() {
  return typeof window === 'undefined' ? undefined : window.Telegram?.WebApp;
}

/** Raw initData string for API auth, or '' outside Telegram. */
export function getInitData(): string {
  return getTg()?.initData ?? '';
}

const GUEST_KEY = 'tf_guest_id';

/**
 * Stable per-browser id for anyone opening the app outside Telegram (a
 * colleague checking a link, a plain-browser visitor). Without this the
 * backend 401s and the screen falls back to its static constants — this way
 * they get real API responses and show up in the admin dashboard as a named
 * "Guest" user instead of vanishing.
 */
export function getGuestId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

/**
 * Show Telegram's native back button while this component is mounted and call
 * `onBack` when it is tapped. No-ops in a plain browser, so screens still work
 * in dev and in the pixel-diff harness.
 *
 * Callers pass `onBack={() => nav(-1)}` inline, a fresh function every
 * render. Routing that through the effect's dep array made it show()/hide()
 * on every render, not just mount/unmount — on iOS that native button
 * toggle is visibly animated, so it flickered through each page transition.
 * A ref keeps the click handler current without re-touching the button.
 */
export function useBackButton(onBack?: () => void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    const bb = getTg()?.BackButton;
    if (!bb || !onBackRef.current) return;

    const handler = () => onBackRef.current?.();
    bb.onClick(handler);
    bb.show();
    return () => {
      bb.offClick(handler);
      bb.hide();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!onBack]);
}
