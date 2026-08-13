import type { ReactNode } from 'react';
import heroArt from '../../assets/splash/hero.png';
import './Splash.css';

/* ---------------------------------------------------------------------------
 * Splash / boot screen — frame 548:3095 (360x852).
 * Hero visual 0,92 -> 360x429, then the copy block at 32,569 -> 296x212:
 * title 296x40, body 296x84, and the progress row (track 215x8 centred at
 * x=40, "Preparing..." under it).
 *
 * Colours/type below come from the frame's own design context (root #144CCD,
 * white copy at .72 opacity, track rgba(255,255,255,.08)) — see Splash.css.
 * The hero is a collage of ~30 rotated card mock-ups, i.e. artwork; it ships
 * as one PNG captured from the frame at 1:1.
 * ------------------------------------------------------------------------- */

const TRACK_W = 215; // frame 1464:4792
const FILL_W = 94; //  frame 1464:4793

/** How long the self-driving bar takes to fill. Drives the CSS ramp too.
    Boot passes real progress instead (App.Boot) — this is for the bare route. */
export const SPLASH_MS = 4000;

export interface SplashProps {
  /** 0..1. Omit and the bar drives itself over SPLASH_MS. */
  progress?: number;
  label?: string;
}

export function Splash({ progress, label = 'Preparing...' }: SplashProps): ReactNode {
  /* No progress prop = nothing real to report, so the bar runs its own ramp.
     The inline width stays the frame's 94px underneath it: the ramp is a CSS
     animation behind prefers-reduced-motion, and animations outrank inline
     styles, so a reduced-motion render (the pixel harness) lands on the frame. */
  const auto = progress === undefined;
  const clamped = Math.max(0, Math.min(1, progress ?? FILL_W / TRACK_W));
  const pct = clamped * 100;
  // Round to whole px — a fractional width lands half-lit on the fill's edge.
  // Never below 8: at 0 the track reads as broken rather than as not-started
  // yet. 8 is the ramp's own first keyframe, i.e. a round cap's worth of bar.
  const fillPx = Math.max(8, Math.round(clamped * TRACK_W));

  return (
    <div className="scr-splash">
      <img className="scr-splash-hero" src={heroArt} alt="" width={360} height={429} fetchPriority="high" />

      <div className="scr-splash-copy">
        <div className="scr-splash-text">
          <h1 className="scr-splash-title type-text-xl-bold">A Smarter Way to Trade</h1>
          <p className="scr-splash-body type-text-sm">
            Manage your membership, signals, rewards &amp; trading services, all in one trusted place.
          </p>
        </div>

        <div className="scr-splash-progress">
          <div
            className="scr-splash-track"
            role="progressbar"
            /* Indeterminate while it drives itself — the ramp is a stand-in for
               loading, not a measurement of it. */
            aria-valuenow={auto ? undefined : Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              className={auto ? 'scr-splash-fill scr-splash-fill--auto' : 'scr-splash-fill'}
              style={{ width: `${fillPx}px`, animationDuration: `${SPLASH_MS}ms` }}
            />
          </div>
          <p className="scr-splash-label type-text-sm">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default Splash;
