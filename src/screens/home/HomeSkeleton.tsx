import type { CSSProperties, ReactNode } from 'react';
import './HomeSkeleton.css';

/* ---------------------------------------------------------------------------
 * Home loading skeleton — frame 551:3097 (360x1806).
 * Every block is a plain shimmer rectangle at the exact geometry of the card
 * it stands in for: hero 328x396 @16,90 (copy lines + CTA inside), promo
 * 328x110 @16,512, signal card 328x504 @16,646, plans card 328x520 @16,1174.
 * ------------------------------------------------------------------------- */

/** One shimmer rectangle. `w`/`h` are px, matching the frame. */
function Block({ w, h, style }: { w?: number | string; h: number; style?: CSSProperties }): ReactNode {
  return <span className="scr-skel-block" style={{ width: w ?? '100%', height: h, ...style }} />;
}

export function HomeSkeleton(): ReactNode {
  return (
    <div className="scr-skel" aria-busy="true" aria-label="Loading">
      {/* hero 328x396 */}
      <section className="scr-skel-card" style={{ height: 396 }}>
        <div className="scr-skel-hero-copy">
          <Block w={148} h={24} style={{ margin: '0 auto' }} />
          <div className="scr-skel-hero-lines">
            <Block h={16} />
            <Block h={16} />
          </div>
        </div>
        <Block h={44} style={{ borderRadius: 8 }} />
      </section>

      {/* promo 328x110 */}
      <Block h={110} style={{ borderRadius: 16 }} />

      {/* signal card 328x504 */}
      <section className="scr-skel-card" style={{ height: 504 }}>
        <Block w={183} h={24} />
        <Block h={60} style={{ marginTop: 16 }} />
        <Block h={80} style={{ marginTop: 16 }} />
        <Block h={40} style={{ marginTop: 236 }} />
      </section>

      {/* plans card 328x520 */}
      <section className="scr-skel-card" style={{ height: 520 }}>
        <Block w={183} h={24} />
        <Block h={76} style={{ marginTop: 20 }} />
        <Block h={268} style={{ marginTop: 12 }} />
        <Block h={76} style={{ marginTop: 12 }} />
      </section>
    </div>
  );
}

export default HomeSkeleton;
