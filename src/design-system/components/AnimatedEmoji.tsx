import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import lottie from 'lottie-web/build/player/lottie_light';
import { Skeleton } from './Skeleton';
import './AnimatedEmoji.css';

/**
 * AnimatedEmoji — Telegram animated emoji (.tgs) as Lottie.
 *
 * Source pack: https://t.me/addemoji/FinanceEmoji, pulled and un-gzipped by
 * `scripts/get-stickers.mjs`. A .tgs is just gzipped Lottie JSON, so the player
 * is plain lottie-web with no Telegram-specific shim.
 *
 * `lottie_light`, not the full build: the full one runs Lottie expressions
 * through `eval`, which Telegram's webview CSP can refuse. The TGS format
 * forbids expressions outright, so the light player loses nothing here.
 *
 * `src` is a URL, not an imported object — the JSONs are ~40KB each and
 * `import x from './e.json'` would inline all of that into the JS bundle.
 * Import with `?url` so they stay separate, cacheable files.
 */

/* Parsed animations, keyed by URL. The splash fills this (see preloadEmoji /
   App.Boot) so every emoji after boot mounts from memory instead of showing a
   skeleton while 40-100KB arrives. Not an LRU: four files, ~280KB total, all of
   them wanted for the whole session.
   ponytail: plain Map, add eviction if the emoji set ever stops being tiny. */
const cache = new Map<string, unknown>();

/** Fetch + parse the given emoji JSONs into the cache. Never rejects — a failed
    preload just means that one falls back to loading by URL on mount. */
export function preloadEmoji(urls: string[]): Promise<unknown> {
  return Promise.all(
    urls.map((url) =>
      cache.has(url)
        ? null
        : fetch(url)
            .then((r) => r.json())
            .then((data) => cache.set(url, data))
            .catch(() => {}),
    ),
  );
}
/* Plays once on mount and parks on the last frame. A looping emoji is motion
   with nothing to say after the first pass — it just pulls the eye off whatever
   the screen is actually asking for. Pass loop to opt back in. */
export function AnimatedEmoji({
  src,
  loop = false,
  className,
}: {
  src: string;
  loop?: boolean;
  /** Sizes the box — lottie fills it and letterboxes, so a non-square box is fine. */
  className?: string;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  // Preloaded on the splash, so normally there is nothing to wait for. The
  // skeleton is for the miss: a real network fetch (~40KB) with no constant to
  // fall back on — unlike the rest of the app's data, there is no sensible
  // "static art" to paint in its place.
  const [ready, setReady] = useState(() => cache.has(src));

  useEffect(() => {
    const hit = cache.get(src);
    setReady(hit !== undefined);
    // Read per-mount rather than via a listener: these sit on static hero art,
    // so a mid-session preference flip re-rendering isn't worth the subscription.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anim = lottie.loadAnimation({
      container: host.current!,
      // Cloned: lottie mutates the data it is handed, and the same emoji is
      // mounted by more than one screen.
      ...(hit === undefined ? { path: src } : { animationData: structuredClone(hit) }),
      renderer: 'svg',
      loop: loop && !still,
      autoplay: !still,
    });
    anim.addEventListener('DOMLoaded', () => {
      // Frame 0 of these is usually an empty stage (the art scales//fades in), so
      // parking on the last frame is what actually shows the emoji at rest.
      if (still) anim.goToAndStop(anim.totalFrames - 1, true);
      setReady(true);
    });
    return () => anim.destroy();
  }, [src, loop]);

  return (
    <div className={'ds-emoji' + (className ? ' ' + className : '')} aria-hidden="true">
      {/* lottie manages this node's children imperatively (see loadAnimation
          above) — it stays a plain, always-rendered div so React never has to
          reconcile children lottie put there itself. The skeleton is a sibling,
          not a child, for the same reason. */}
      <div ref={host} className="ds-emoji-stage" />
      {ready ? null : <Skeleton className="ds-emoji-skeleton" />}
    </div>
  );
}
