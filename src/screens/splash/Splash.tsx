import type { ReactNode } from 'react';
import './Splash.css';

/* ---------------------------------------------------------------------------
 * Splash / boot screen — frame 548:3095 (360x852).
 * Hero visual 0,92 -> 360x429, then the copy block at 32,569 -> 296x212:
 * title 296x40, body 296x84, and the progress row (track 215x8 centred at
 * x=40, "Preparing..." under it).
 *
 * ponytail: the hero is a collage of ~30 rotated card mock-ups in Figma — it is
 * artwork, not layout, so it belongs in src/assets as one exported PNG. The
 * Figma image-export endpoint is rate-limited, so this ships a plain branded
 * panel; drop the export in and swap `.scr-splash-hero`'s background for it.
 * ------------------------------------------------------------------------- */

export interface SplashProps {
  /** 0..1. The frame shows the track ~44% filled (94 of 215). */
  progress?: number;
  label?: string;
}

export function Splash({ progress = 0.44, label = 'Preparing...' }: SplashProps): ReactNode {
  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <div className="scr-splash">
      <div className="scr-splash-hero" aria-hidden="true" />

      <div className="scr-splash-copy">
        <h1 className="scr-splash-title type-text-xl-bold">A Smarter Way to Trade</h1>
        <p className="scr-splash-body type-text-sm">
          Manage your membership, signals, rewards &amp; trading services, all in one trusted place.
        </p>

        <div className="scr-splash-progress">
          <div
            className="scr-splash-track"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="scr-splash-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="scr-splash-label type-text-sm">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default Splash;
