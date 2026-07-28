import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, UIEvent } from 'react';
import { Icon, NavigationBar } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import { PlanCard } from '../plans/PlanCard';
import { PLANS } from '../plans/plans-data';
import type { Plan } from '../plans/plans-data';
import heroExpiredArt from '../../assets/home/hero-expired.png';
import heroWalletArt from '../../assets/home/hero-wallet.png';
import promoInviteArt from '../../assets/home/promo-invite.png';
import promoGiftArt from '../../assets/home/promo-gift.png';
import promoTrophyArt from '../../assets/home/promo-trophy.png';
import './Home.css';

/* ---------------------------------------------------------------------------
 * Home — route `/`. Figma nodes 552-3106 (active, canonical) / 552-3107
 * (expired) / 639-4482 (no-subscription). One component, driven by a
 * `subscription` state; only the hero card, the centred promo slide and the
 * "Choose your plan" section (Gold expands in the no-subscription state)
 * change between the three. The Telegram webview header and iOS status bar
 * are chrome, not app content, so they are intentionally not built.
 * ------------------------------------------------------------------------- */

export type Subscription = 'active' | 'expired' | 'none';
type Period = 'Weekly' | 'Monthly' | 'Yearly';

export interface HomeProps {
  /** Which subscription state to show first. Defaults to `active`. */
  initialSubscription?: Subscription;
  /** CTA routing (View plans / Upgrade / Join VIP / Renew / plan tap). */
  onNavigate?: (route: string) => void;
  /** Bottom-nav tab change. */
  onTabChange?: (tab: NavigationTab) => void;
}

/* ---- static data ---------------------------------------------------------- */
const TP_TABS = [
  { id: 'TP1', rr: 'RR 1:0.5' },
  { id: 'TP2', rr: 'RR 1:1' },
  { id: 'TP3', rr: 'RR 1:2' },
  { id: 'TP4', rr: 'RR 1:3' },
] as const;

const PERIODS: Record<Period, { overview: string; date: string }> = {
  Weekly: { overview: 'Last 4 weeks overview', date: 'August · Week 1' },
  Monthly: { overview: 'Last 3 months overview', date: 'September 2026' },
  Yearly: { overview: 'Last 12 months overview', date: 'Q1 2026' },
};

interface Promo {
  id: string;
  bg: string;
  tag: string;
  title: string;
  subtitle: string;
  art: string;
  /** Art layer is 141×148 bleeding past the slide's top+right edge (clipped);
   *  per-slide offsets from the XML. */
  artRight: number;
  artTop: number;
}
// Fixed order left→right in the source: Summer, Invite, Complete.
const PROMOS: readonly Promo[] = [
  { id: 'summer', bg: '#7A9DFE', tag: 'Special offer', title: 'Summer discount', subtitle: 'Get 20% OFF on 12 month plan', art: promoGiftArt, artRight: -26, artTop: -24 },
  { id: 'invite', bg: '#68CB64', tag: 'Invite & earn', title: 'Invite friends', subtitle: 'Get 10% from thier deposits', art: promoInviteArt, artRight: -40, artTop: -24 },
  { id: 'tasks', bg: '#FFA202', tag: 'Stay active', title: 'Complete tasks', subtitle: 'Win rewards & get amazing prizes', art: promoTrophyArt, artRight: -40, artTop: -31 },
];
const PROMO_START: Record<Subscription, number> = { active: 1, expired: 2, none: 0 };


// Signal-performance area chart — synthesised to match the render's silhouette
// (exact vector not exported from Figma): high mid baseline, twin peaks at
// ~31%/40% width, crosshair x=155, trough at ~76%, late rebound bump at ~82%.
const CHART_LINE =
  'M 0 100 L 8 96 L 16 102 L 24 94 L 32 99 L 40 92 L 48 96 L 56 88 L 64 92 L 72 84 L 80 74 L 86 64 L 92 52 L 98 62 L 104 68 L 110 52 L 118 42 L 126 50 L 134 56 L 141 52 L 148 53 L 155 56 L 164 62 L 172 74 L 180 80 L 188 78 L 196 90 L 204 96 L 212 94 L 220 104 L 228 110 L 236 92 L 243 72 L 250 80 L 258 92 L 266 96 L 274 88 L 282 92 L 290 86 L 296 88';
const CHART_AREA = `${CHART_LINE} L 296 164 L 0 164 Z`;
const CHART_PEAK_X = 155; // px within the 296-wide plot (XML crosshair x)

/* ===========================================================================
 * Countdown ring — SVG semicircle gauge, green arc via stroke-dasharray.
 * The exact filled-crescent geometry isn't derivable, so the green fraction
 * is tuned to match the render (~0.66 of the 180° arc).
 * ========================================================================= */
function CountdownRing({ days }: { days: number }): ReactNode {
  // Arc vector is 224×112 in a 232×112 box (x4..228 incl the 16px stroke)
  // → path radius 104 centred at (116,104); round caps close flush at y112.
  const len = Math.PI * 104; // arc length of the semicircle
  const green = len * 0.66;
  return (
    <div className="scr-home-ring">
      <svg viewBox="0 0 232 112" fill="none">
        <path
          d="M 12 104 A 104 104 0 0 1 220 104"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={16}
          strokeLinecap="round"
        />
        <path
          d="M 12 104 A 104 104 0 0 1 220 104"
          stroke="#48D48A"
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${green} ${len}`}
        />
      </svg>
      <div className="scr-home-ring-center">
        <span className="scr-home-ring-num">{days}</span>
        <span className="scr-home-ring-sub">Days left</span>
      </div>
    </div>
  );
}

/* ---- hero: active --------------------------------------------------------- */
function HeroActive({ onNavigate }: { onNavigate?: (r: string) => void }): ReactNode {
  return (
    <section className="scr-home-hero scr-home-hero--active">
      <div className="scr-home-hero-top">
        <div className="scr-home-ringbox">
          <CountdownRing days={22} />
        </div>

        <div className="scr-home-status">
          <div className="scr-home-statusrow">
            <span className="scr-home-status-label">Subscription status</span>
            <span className="scr-home-pill">
              <Icon name="check" size={16} strokeWidth={1.75} />
              Active
            </span>
          </div>
          <div className="scr-home-statusrow">
            <span className="scr-home-status-label">Current plan</span>
            <span className="scr-home-status-plan">
              <b>Silver</b>
              <span>/ 1 Month</span>
            </span>
          </div>
          <div className="scr-home-statusrow">
            <span className="scr-home-status-label">Expires on</span>
            <span className="scr-home-status-value">Aug 24,2026</span>
          </div>
        </div>
      </div>

      <div className="scr-home-hero-buttons">
        <button type="button" className="scr-home-herobtn scr-home-herobtn--solid" onClick={() => onNavigate?.('vip-channel')}>
          Join VIP channel
        </button>
        <button type="button" className="scr-home-herobtn scr-home-herobtn--ghost" onClick={() => onNavigate?.('plans')}>
          Upgrade
        </button>
      </div>
    </section>
  );
}

/* ---- hero: expired / none ------------------------------------------------- */
function HeroMessage({
  art,
  title,
  subtitle,
  ctaLabel,
  note,
  onCta,
}: {
  art: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  note?: string;
  onCta?: () => void;
}): ReactNode {
  return (
    <section className="scr-home-hero scr-home-hero--message">
      <div className="scr-home-hero-message-top">
        <img className="scr-home-hero-art" src={art} alt="" width={140} height={140} />
        <div className="scr-home-hero-copy">
          <span className="scr-home-hero-title">{title}</span>
          <span className="scr-home-hero-subtitle">{subtitle}</span>
        </div>
      </div>
      <div className="scr-home-hero-bottom">
        <button type="button" className="scr-home-herobtn scr-home-herobtn--full" onClick={onCta}>
          {ctaLabel}
        </button>
        {note ? <span className="scr-home-hero-note">{note}</span> : null}
      </div>
    </section>
  );
}

/* ---- promo carousel ------------------------------------------------------- */
function PromoCarousel({ start }: { start: number }): ReactNode {
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

/* ---- signal performance --------------------------------------------------- */
function SignalCard(): ReactNode {
  const [tp, setTp] = useState<string>('TP1');
  const [period, setPeriod] = useState<Period>('Monthly');
  const cfg = PERIODS[period];

  return (
    <section className="scr-home-card scr-home-signal">
      <div className="scr-home-signal-head">
        <h2 className="scr-home-card-title">Signal performance</h2>
        <div className="scr-home-tp">
          {TP_TABS.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 ? <span className="scr-home-tp-div" /> : null}
              <button
                type="button"
                className={'scr-home-tp-btn' + (t.id === tp ? ' scr-home-tp-btn--on' : '')}
                onClick={() => setTp(t.id)}
              >
                <span className="scr-home-tp-name">{t.id}</span>
                <span className="scr-home-tp-rr">{t.rr}</span>
              </button>
            </Fragment>
          ))}
        </div>
      </div>

      <div className="scr-home-overview">
        <span className="scr-home-overview-title">• {cfg.overview}</span>
        <div className="scr-home-overview-stats">
          <div className="scr-home-stat">
            <span className="scr-home-stat-label">Total signals</span>
            <span className="scr-home-stat-value">80</span>
          </div>
          <div className="scr-home-stat">
            <span className="scr-home-stat-label">TP1 reached</span>
            <span className="scr-home-stat-value">50</span>
          </div>
          <div className="scr-home-stat">
            <span className="scr-home-stat-label">TP1 hit rate</span>
            <span className="scr-home-stat-value scr-home-stat-value--success">62.0%</span>
          </div>
        </div>
      </div>

      <div className="scr-home-chart">
        <svg className="scr-home-chart-svg" viewBox="0 0 296 164" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="scr-home-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#144CCD" stopOpacity="0.33" />
              <stop offset="1" stopColor="#144CCD" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={CHART_AREA} fill="url(#scr-home-chart-fill)" />
          <path d={CHART_LINE} stroke="#144CCD" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <span className="scr-home-chart-crosshair" style={{ left: `${CHART_PEAK_X}px` }} />
        <span className="scr-home-chart-marker" style={{ left: `${CHART_PEAK_X}px`, top: 73 }} />
        <div className="scr-home-tooltip" style={{ left: `${CHART_PEAK_X}px` }}>
          <span className="scr-home-tooltip-date">{cfg.date}</span>
          <div className="scr-home-tooltip-row">
            <span>Signals</span>
            <span>36</span>
          </div>
          <div className="scr-home-tooltip-row">
            <span>TP1 reached</span>
            <span>12</span>
          </div>
          <div className="scr-home-tooltip-row scr-home-tooltip-row--success">
            <span>TP1 hit rate</span>
            <span>65.4%</span>
          </div>
        </div>
      </div>

      <div className="scr-home-period">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            className={'scr-home-period-btn' + (p === period ? ' scr-home-period-btn--on' : '')}
            onClick={() => setPeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---- compact plan row (Choose your plan) ---------------------------------- */
function PlanRow({ plan, onClick }: { plan: Plan; onClick?: () => void }): ReactNode {
  return (
    <button type="button" className="scr-home-planrow" onClick={onClick}>
      <img className="scr-home-planrow-badge" src={plan.badge} alt="" width={56} height={56} />
      <span className="scr-home-planrow-text">
        <span className="scr-home-planrow-namerow">
          <span className="scr-home-planrow-name">{plan.name}</span>
          {plan.tag ? <span className={`scr-home-tag scr-home-tag--${plan.tag.variant}`}>{plan.tag.label}</span> : null}
        </span>
        <span className="scr-home-planrow-pricerow">
          <Icon name="currency-dollar" size={20} strokeWidth={1.7} />
          <span className="scr-home-planrow-price">{plan.price}</span>
          <span className="scr-home-planrow-duration">/ {plan.duration}</span>
        </span>
      </span>
    </button>
  );
}

/* ---- choose your plan ----------------------------------------------------- */
function ChoosePlanSection({
  subscription,
  onNavigate,
}: {
  subscription: Subscription;
  onNavigate?: (r: string) => void;
}): ReactNode {
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <section className="scr-home-card scr-home-plans">
      <div className="scr-home-plans-head">
        <h2 className="scr-home-card-title">Choose your plan</h2>
        <button
          type="button"
          className="scr-home-info"
          aria-label="Plan info"
          onClick={() => setTipOpen((v) => !v)}
        >
          <Icon name="info" size={20} strokeWidth={1.5} />
        </button>
      </div>

      {tipOpen ? (
        <div className="scr-home-infotip" role="tooltip">
          Longer subscriptions include greater savings and higher benefit rates
        </div>
      ) : null}

      {PLANS.map((plan) =>
        subscription === 'none' && plan.id === 'gold' ? (
          <PlanCard key={plan.id} plan={plan} variant="full" onContinue={() => onNavigate?.('checkout')} />
        ) : (
          <PlanRow key={plan.id} plan={plan} onClick={() => onNavigate?.('plans')} />
        ),
      )}
    </section>
  );
}

/* ===========================================================================
 * Home
 * ========================================================================= */
export default function Home({ initialSubscription = 'active', onNavigate, onTabChange }: HomeProps): ReactNode {
  const [subscription, setSubscription] = useState<Subscription>(initialSubscription);

  return (
    <div className="scr-home">
      {/* dev-only switcher so all three states are reachable in review */}
      <div className="scr-home-switcher" role="group" aria-label="Subscription state">
        {(['active', 'expired', 'none'] as Subscription[]).map((s) => (
          <button key={s} type="button" data-on={subscription === s} onClick={() => setSubscription(s)}>
            {s}
          </button>
        ))}
      </div>

      {subscription === 'active' ? (
        <HeroActive onNavigate={onNavigate} />
      ) : subscription === 'expired' ? (
        <HeroMessage
          art={heroExpiredArt}
          title="Your subscription has expired"
          subtitle="Regain VIP signal access and enjoy your member benefits again."
          ctaLabel="Renew subscription"
          note="Expired on Aug 24, 2025"
          onCta={() => onNavigate?.('plans')}
        />
      ) : (
        <HeroMessage
          art={heroWalletArt}
          title="No active subscription"
          subtitle="Choose a plan to join the VIP signal channel and unlock additional member benefits"
          ctaLabel="View plans"
          onCta={() => onNavigate?.('plans')}
        />
      )}

      <PromoCarousel start={PROMO_START[subscription]} />

      <SignalCard />

      <ChoosePlanSection subscription={subscription} onNavigate={onNavigate} />

      <div className="scr-home-navbar">
        <NavigationBar active="home" onChange={onTabChange} />
      </div>
    </div>
  );
}
