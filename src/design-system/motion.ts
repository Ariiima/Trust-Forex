/* Shared motion vocabulary. Every animated thing pulls its timing from here so
 * the app feels like one object rather than a dozen separately-tuned parts.
 *
 * Everything must collapse to nothing under `prefers-reduced-motion: reduce`.
 * That is an accessibility rule, but here it is also load-bearing: the pixel
 * harness (design/review/shoot.mjs) captures with `reducedMotion: 'reduce'`,
 * and the Figma diff is only deterministic if the app is holding still by the
 * time it shoots. `<MotionConfig reducedMotion="user">` in App.tsx enforces it
 * for transform and layout; opacity keeps animating even then, so anything
 * opacity-only is kept far shorter than the harness's settle wait.
 */
import type { Transition } from 'motion/react';

/** Sheets and drawers — things with weight. Fast out, no bounce, iOS-ish. */
export const SHEET: Transition = { type: 'spring', stiffness: 420, damping: 42 };

/** Small solids that appear or move: the nav pill, chips, badges. A little snap. */
export const POP: Transition = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 };

/** Scrims and crossfades — anything that only changes opacity. */
export const FADE: Transition = { duration: 0.18, ease: [0.4, 0, 0.2, 1] };

/* No screen-to-screen transition on purpose — see the note above AppRoutes in
 * App.tsx. Route swaps have no overlap to fade across, so any entrance fade
 * shows through to the page background. */
