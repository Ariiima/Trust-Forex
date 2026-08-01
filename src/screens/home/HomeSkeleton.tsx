import type { ReactNode } from 'react';
import { NavigationBar } from '../../design-system/components';
import './HomeSkeleton.css';

/* ---------------------------------------------------------------------------
 * Home loading skeleton — frame 551:3097 (360x1806, chrome-less height 1730).
 *
 * The whole screen is flat rectangles, so every value below is measured off the
 * Figma render rather than derived from tokens:
 *   page        #F1F1F1, 16px side inset, 14px above the first card
 *   card surface#E4E4E4, 328 wide, radius 16 (the promo strip is radius 12)
 *   placeholder #F1F1F1 rectangles, absolutely placed inside their card
 * Card heights and the gaps between them (26 / 24 / 24) come from the frame.
 * ------------------------------------------------------------------------- */

interface Rect {
  /** left/top relative to the card box */
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

/** One shimmer rectangle, absolutely placed inside its card. */
function Block({ x, y, w, h, r }: Rect): ReactNode {
  return (
    <span
      className="scr-skel-block"
      style={{ left: x, top: y, width: w, height: h, borderRadius: r }}
    />
  );
}

const HERO: Rect[] = [
  { x: 91, y: 199, w: 146, h: 22, r: 11 }, // title
  { x: 41, y: 239, w: 246, h: 14, r: 7 }, // copy line 1
  { x: 41, y: 263, w: 246, h: 14, r: 7 }, // copy line 2
  { x: 16, y: 336, w: 296, h: 44, r: 8 }, // CTA
];

const SIGNAL: Rect[] = [
  { x: 17, y: 17, w: 181, h: 22, r: 11 }, // section title
  { x: 17, y: 57, w: 294, h: 58, r: 11 },
  { x: 17, y: 133, w: 294, h: 78, r: 11 },
  { x: 17, y: 449, w: 294, h: 38, r: 7 },
];

const PLANS: Rect[] = [
  { x: 17, y: 17, w: 181, h: 22, r: 11 }, // section title
  { x: 17, y: 61, w: 294, h: 74, r: 11 },
  { x: 16, y: 148, w: 296, h: 268, r: 12 },
  { x: 17, y: 429, w: 294, h: 74, r: 11 },
];

function Card({ h, mt, children }: { h: number; mt?: number; children?: ReactNode }): ReactNode {
  return (
    <div className="scr-skel-card" style={{ height: h, marginTop: mt }}>
      {children}
    </div>
  );
}

export function HomeSkeleton(): ReactNode {
  return (
    <div className="scr-skel" aria-busy="true" aria-label="Loading">
      <Card h={396}>
        {HERO.map((b) => (
          <Block key={`${b.x}-${b.y}`} {...b} />
        ))}
      </Card>

      {/* promo strip — a bare surface, no placeholders inside */}
      <div className="scr-skel-card scr-skel-card--promo" style={{ height: 110, marginTop: 26 }} />

      <Card h={504} mt={24}>
        {SIGNAL.map((b) => (
          <Block key={`${b.x}-${b.y}`} {...b} />
        ))}
      </Card>

      <Card h={520} mt={24}>
        {PLANS.map((b) => (
          <Block key={`${b.x}-${b.y}`} {...b} />
        ))}
      </Card>

      <div className="scr-skel-navbar">
        <NavigationBar active="home" />
      </div>
    </div>
  );
}

export default HomeSkeleton;
