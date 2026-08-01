import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, UIEvent } from 'react';
import promoInviteArt from '../../assets/home/promo-invite.png';
import promoGiftArt from '../../assets/home/promo-gift.png';
import promoTrophyArt from '../../assets/home/promo-trophy.png';
import './Home.css';

/* Shared promo carousel — Home (552:3106 et al) and the referral main page
 * (1338:4704) render the same component, so it lives on its own. Styles stay
 * in Home.css under the .scr-home-carousel/.scr-home-slide names. */

interface Promo {
  id: string;
  bg: string;
  tag: string;
  title: string;
  subtitle: string;
  art: string;
  artRight: number;
  artTop: number;
}

// Fixed order left→right in the source: Summer, Invite, Complete.
export const PROMOS: readonly Promo[] = [
  { id: 'summer', bg: '#7A9DFE', tag: 'Special offer', title: 'Summer discount', subtitle: 'Get 20% OFF on 12 month plan', art: promoGiftArt, artRight: -26, artTop: -24 },
  { id: 'invite', bg: '#68CB64', tag: 'Invite & Earn', title: 'invite friends', subtitle: 'get 10% from thier deposits', art: promoInviteArt, artRight: -40, artTop: -24 },
  { id: 'tasks', bg: '#FFA202', tag: 'Stay active', title: 'Complete tasks', subtitle: 'Win rewards & get amazing prizes', art: promoTrophyArt, artRight: -40, artTop: -31 },
];

export function PromoCarousel({ start }: { start: number }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = start * el.clientWidth;
    setIndex(start);
  }, [start]);

  const onScroll = (e: UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="scr-home-carousel" ref={ref} onScroll={onScroll}>
      {PROMOS.map((p) => (
        <div className="scr-home-slide" key={p.id} style={{ background: p.bg }}>
          <div className="scr-home-slide-text">
            <span className="scr-home-slide-tag">{p.tag}</span>
            <span className="scr-home-slide-title">{p.title}</span>
            <span className="scr-home-slide-sub">{p.subtitle}</span>
          </div>
          <img className="scr-home-slide-art" src={p.art} alt="" width={94} height={110} />
          <div className="scr-home-dots">
            {PROMOS.map((d, i) => (
              <span key={d.id} className={'scr-home-dot' + (i === index ? ' scr-home-dot--on' : '')} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
