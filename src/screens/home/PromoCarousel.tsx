import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, UIEvent } from 'react';
import { useReducedMotion } from 'motion/react';
import { cachedPromos, getPromos, type PromoSection } from '../../api/client';
import promoInviteArt from '../../assets/home/promo-invite.png';
import promoGiftArt from '../../assets/home/promo-gift.png';
import promoTrophyArt from '../../assets/home/promo-trophy.png';
import './Home.css';

/* Shared promo carousel — Home (552:3106 et al), the cashback hub (850:2053)
 * and the referral main page (1338:4704) all render this one component, so it
 * lives on its own. Styles stay in Home.css under the
 * .scr-home-carousel/.scr-home-slide names. */

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

/* Shown when the campaigns API has nothing for this screen (or isn't reachable
   — the static deploy has no server). Fixed order left→right in the source:
   Summer, Invite, Complete. */
export const PROMOS: readonly Promo[] = [
  { id: 'summer', bg: '#7A9DFE', tag: 'Special offer', title: 'Summer discount', subtitle: 'Get 20% OFF on 12 month plan', art: promoGiftArt, artRight: -26, artTop: -24 },
  { id: 'invite', bg: '#68CB64', tag: 'Invite & Earn', title: 'invite friends', subtitle: 'get 10% from thier deposits', art: promoInviteArt, artRight: -40, artTop: -24 },
  { id: 'tasks', bg: '#FFA202', tag: 'Stay active', title: 'Complete tasks', subtitle: 'Win rewards & get amazing prizes', art: promoTrophyArt, artRight: -40, artTop: -31 },
];

// Also the fill's animation-duration (set inline on the fill below) so the
// sweep and the advance cannot drift apart — one number, not a JS timer racing
// a CSS one.
const DWELL_MS = 4500;

/** Scroll offset of slide `i` — its own offsetLeft rather than `i * width`, so
    this survives any gap or padding the strip picks up later. */
function slideLeft(el: HTMLElement, i: number): number {
  return (el.children[i] as HTMLElement | undefined)?.offsetLeft ?? 0;
}

/* A campaign card carries no colour or art of its own (the admin form has no
   field for either), so it borrows the built-in palette by position. */
function fromCampaigns(section: PromoSection): Promo[] | undefined {
  const live = cachedPromos(section);
  if (!live?.length) return undefined;
  return live.map((c, i) => ({
    ...PROMOS[i % PROMOS.length],
    id: c.id,
    tag: PROMOS[i % PROMOS.length].tag,
    title: c.title,
    subtitle: c.subtitle,
    art: c.image ?? PROMOS[i % PROMOS.length].art,
  }));
}

export function PromoCarousel({ start, section }: { start: number; section: PromoSection }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [paused, setPaused] = useState(false);
  const still = useReducedMotion();

  /* Built-in slides render immediately and the campaign ones replace them once
     they land, so the strip is never empty and never flashes. `cachedPromos`
     means that swap happens once a session, not on every tab switch. */
  const [slides, setSlides] = useState<readonly Promo[]>(() => fromCampaigns(section) ?? PROMOS);
  useEffect(() => {
    if (cachedPromos(section)) return;
    let live = true;
    void getPromos(section).then(() => live && setSlides(fromCampaigns(section) ?? PROMOS));
    return () => {
      live = false;
    };
  }, [section]);
  // The fill is a CSS animation, so unmounting it is what restarts the sweep
  // from zero. Nothing to reset by hand.
  const sweeping = !still && !paused;

  // Clamped: `start` indexes the built-in set, and a campaign-driven strip can
  // be shorter than that.
  const from = Math.min(start, slides.length - 1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = slideLeft(el, from);
    setIndex(from);
  }, [from]);

  // Re-armed on every index change, so a swipe or a tap on a dot (both of which
  // move `index`) restarts the dwell exactly like it restarts the fill.
  useEffect(() => {
    if (!sweeping) return;
    const t = setTimeout(() => {
      const el = ref.current;
      // Always right, including off the last slide — that lands on the clone.
      if (el) el.scrollTo({ left: slideLeft(el, index + 1), behavior: 'smooth' });
    }, DWELL_MS);
    return () => clearTimeout(t);
  }, [index, sweeping, slides.length]);

  const snap = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onScroll = (e: UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i < slides.length) {
      setIndex(i);
      return;
    }
    /* On the clone. Wait out the smooth scroll (events keep firing while it
       runs, so this only lands once it settles), then jump to the real first
       slide — identical pixels, so the jump is invisible. That jump fires one
       more scroll event, which sets index 0. */
    clearTimeout(snap.current);
    snap.current = setTimeout(() => {
      const s = ref.current;
      if (s) s.scrollLeft = slideLeft(s, 0);
    }, 120);
  };

  const goTo = (i: number): void => {
    const el = ref.current;
    if (el) el.scrollTo({ left: slideLeft(el, i), behavior: still ? 'auto' : 'smooth' });
  };

  return (
    /* The dots are a sibling of the scroller, not a child of each slide. Inside
       a slide they belonged to that card and slid off-screen with it, instead
       of holding their place and tracking which card is showing. */
    <div className="scr-home-carousel-wrap">
      <div
        className="scr-home-carousel"
        ref={ref}
        onScroll={onScroll}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
      >
        {/* A copy of the first slide sits after the last one, so wrapping around
            keeps moving right instead of rewinding the strip. */}
        {[...slides, slides[0]].map((p, i) => (
          <div className="scr-home-slide" key={`${p.id}-${i}`} style={{ background: p.bg }}>
            <div className="scr-home-slide-text">
              <span className="scr-home-slide-tag">{p.tag}</span>
              <span className="scr-home-slide-title">{p.title}</span>
              <span className="scr-home-slide-sub">{p.subtitle}</span>
            </div>
            <img className="scr-home-slide-art" src={p.art} alt="" width={94} height={110} />
          </div>
        ))}
      </div>
      <div className="scr-home-dots">
        {slides.map((d, i) => (
          <button
            type="button"
            key={d.id}
            className={'scr-home-dot' + (i === index ? ' scr-home-dot--on' : '')}
            onClick={() => goTo(i)}
            aria-label={d.title}
            aria-current={i === index}
          >
            {i === index && sweeping ? (
              <span className="scr-home-dot-fill" style={{ animationDuration: `${DWELL_MS}ms` }} />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
