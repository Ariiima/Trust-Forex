import { useEffect } from 'react';

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

/**
 * Show Telegram's native back button while this component is mounted and call
 * `onBack` when it is tapped. No-ops in a plain browser, so screens still work
 * in dev and in the pixel-diff harness.
 */
export function useBackButton(onBack?: () => void): void {
  useEffect(() => {
    const bb = getTg()?.BackButton;
    if (!bb || !onBack) return;

    bb.onClick(onBack);
    bb.show();
    return () => {
      bb.offClick(onBack);
      bb.hide();
    };
  }, [onBack]);
}
