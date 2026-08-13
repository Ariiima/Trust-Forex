import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

/** Shortest thumb that is still a grabbable-looking mark, in px. */
const MIN_THUMB = 24;

/**
 * Drives the designed 2px scroll rail off the real scroll position.
 *
 * The frames draw the thumb at a fixed height (199px on the referral list, 200
 * on the cashback-history sheet), which is fine as a still and a lie in a
 * scrolling list — it never moves and never tells you how much is below. This
 * returns a ref for the scroll port and the thumb's height/offset, sized from
 * the visible-to-total ratio, so the decoration becomes the actual scrollbar.
 *
 * Measures after every render (a row appearing IS a render) plus on scroll —
 * ponytail: no ResizeObserver, add one if content ever resizes without one.
 */
export function useScrollRail<T extends HTMLElement>(): [RefObject<T | null>, CSSProperties] {
  const ref = useRef<T>(null);
  const [thumb, setThumb] = useState<{ height: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const height = Math.max(MIN_THUMB, Math.round((clientHeight / scrollHeight) * clientHeight));
      const room = scrollHeight - clientHeight;
      const top = room > 0 ? Math.round((scrollTop / room) * (clientHeight - height)) : 0;
      // Same numbers -> same object -> no re-render, so measuring on every
      // render cannot loop.
      setThumb((prev) => (prev && prev.height === height && prev.top === top ? prev : { height, top }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    return () => el.removeEventListener('scroll', measure);
  });

  // Before the first measure the thumb fills the rail rather than flashing at
  // some arbitrary height.
  return [ref, thumb ? { height: thumb.height, top: thumb.top } : { height: '100%', top: 0 }];
}
