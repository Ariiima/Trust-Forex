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

export interface SplashProps {
  /** 0..1. Defaults to the frame's own 94-of-215 fill. */
  progress?: number;
  label?: string;
}

export function Splash({ progress = FILL_W / TRACK_W, label = 'Preparing...' }: SplashProps): ReactNode {
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = clamped * 100;
  // Round to whole px — a fractional width lands half-lit on the fill's edge.
  const fillPx = Math.round(clamped * TRACK_W);

  return (
    <div className="scr-splash">
      <img className="scr-splash-hero" src={heroArt} alt="" width={360} height={429} />

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
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="scr-splash-fill" style={{ width: `${fillPx}px` }} />
          </div>
          <p className="scr-splash-label type-text-sm">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default Splash;
